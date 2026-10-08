// Piezas compartidas por todo lo que modifica un pedido (pedidos, pagos):
// cómo se carga, cómo se bloquea, cómo se recalcula y cómo viaja en el JSON.

import { EstadoItem, EstadoPedido, Prisma, TipoPedido } from "../../generated/prisma/client.js";
import { CERO, dinero, sumar } from "../../lib/dinero.js";
import { conflicto, noEncontrado, sinPermiso } from "../../lib/errores.js";
import type { Tx } from "../../lib/prisma.js";
import { emitirANegocio } from "../../realtime/socket.js";

export const incluirCompleto = {
  mesa: { select: { id: true, nombre: true } },
  mozo: { select: { id: true, nombre: true } },
  repartidor: { select: { id: true, nombre: true, telefono: true } },
  // Un pago anulado no cuenta en ningún total
  pagos: { where: { anuladoEn: null }, select: { monto: true } },
  // En el orden en que se pidieron, ronda tras ronda
  items: { orderBy: [{ orden: "asc" }, { creadoEn: "asc" }, { id: "asc" }] },
} satisfies Prisma.PedidoInclude;

export type PedidoCompleto = Prisma.PedidoGetPayload<{ include: typeof incluirCompleto }>;

// Forma en que el pedido viaja por HTTP y por Socket.IO
export function serializar(p: PedidoCompleto) {
  const totalPagado = sumar(p.pagos.map((pago) => pago.monto));
  const saldo = Prisma.Decimal.max(0, p.total.minus(totalPagado));
  // Vuelto que debe llevar el motorizado: solo si lo que entrega el cliente alcanza
  const vuelto = p.pagaCon && p.pagaCon.greaterThanOrEqualTo(saldo) ? p.pagaCon.minus(saldo) : null;

  return {
    id: p.id,
    numero: p.numero,
    tipo: p.tipo,
    estado: p.estado,
    mesa: p.mesa,
    mesaLiberada: p.mesaLiberada,
    mozo: p.mozo,
    cliente:
      p.nombreCliente || p.telefonoCliente ? { nombre: p.nombreCliente, telefono: p.telefonoCliente } : null,
    direccionEntrega: p.direccionEntrega,
    distritoEntrega: p.distritoEntrega,
    pagoPrevisto:
      p.pagoMomento && p.pagoMetodo
        ? {
            momento: p.pagoMomento,
            metodo: p.pagoMetodo,
            pagaCon: p.pagaCon ? dinero(p.pagaCon) : null,
            vuelto: vuelto ? dinero(vuelto) : null,
          }
        : null,
    motivoCancelacion: p.motivoCancelacion,
    referenciaEntrega: p.referenciaEntrega,
    repartidor: p.repartidor,
    nota: p.nota,
    subtotal: dinero(p.subtotal),
    costoEnvio: dinero(p.costoEnvio),
    cantidadTapers: p.cantidadTapers,
    tapersManual: p.tapersManual,
    cargoTapers: dinero(p.cargoTapers),
    descuento: dinero(p.descuento),
    total: dinero(p.total),
    totalPagado: dinero(totalPagado),
    saldoPendiente: dinero(Prisma.Decimal.max(0, p.total.minus(totalPagado))),
    pagado: p.pagado,
    pagadoEn: p.pagadoEn,
    creadoEn: p.creadoEn,
    items: p.items.map((i) => ({
      id: i.id,
      varianteId: i.varianteId,
      areaId: i.areaId,
      cantidad: i.cantidad,
      estado: i.estado,
      nombreProducto: i.nombreProducto,
      precioUnitario: dinero(i.precioUnitario),
      notas: i.notas,
      componentes: i.componentes,
      orden: i.orden,
      idRonda: i.idRonda,
      creadoEn: i.creadoEn,
      listoEn: i.listoEn,
    })),
  };
}

export type PedidoSerializado = ReturnType<typeof serializar>;

export const obtenerCompleto = (tx: Tx, pedidoId: string) =>
  tx.pedido.findUniqueOrThrow({ where: { id: pedidoId }, include: incluirCompleto });

// Serializa y avisa a los demás dispositivos del negocio. Llamar después del commit.
export function publicar(evento: "pedido:creado" | "pedido:actualizado", completo: PedidoCompleto) {
  const pedido = serializar(completo);
  emitirANegocio(completo.negocioId, evento, pedido);
  return pedido;
}

// Bloquea la fila del negocio: serializa la creación de pedidos y la apertura de
// caja, para que no se repita un correlativo ni se abran dos turnos a la vez
export async function bloquearNegocio(tx: Tx, negocioId: string) {
  const filas = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Negocio" WHERE id = ${negocioId} AND activo FOR UPDATE`;
  if (filas.length === 0) throw sinPermiso("El negocio no está activo");
  // Sin la imagen del logo: no hace falta para tomar un pedido
  return tx.negocio.findUniqueOrThrow({ where: { id: negocioId }, omit: { logo: true } });
}

// Bloquea el pedido durante la transacción para que dos cambios simultáneos
// no recalculen con datos viejos. 404 si no es de este negocio.
export async function bloquearPedido(tx: Tx, negocioId: string, pedidoId: string) {
  const filas = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "Pedido" WHERE id = ${pedidoId} AND "negocioId" = ${negocioId} FOR UPDATE`;
  if (filas.length === 0) throw noEncontrado("El pedido no existe");
  return tx.pedido.findUniqueOrThrow({ where: { id: pedidoId } });
}

export function exigirNoCancelado(pedido: { estado: EstadoPedido }) {
  if (pedido.estado === EstadoPedido.CANCELADO) {
    throw conflicto("PEDIDO_CANCELADO", "El pedido está cancelado");
  }
}

// Estado del pedido a partir de sus items no cancelados
export function calcularEstadoPedido(actual: EstadoPedido, items: EstadoItem[]): EstadoPedido {
  const todos = (...estados: EstadoItem[]) => items.every((e) => estados.includes(e));

  if (items.length === 0) return EstadoPedido.CANCELADO; // no queda nada por servir
  if (todos(EstadoItem.ENTREGADO)) return EstadoPedido.ENTREGADO;
  if (items.includes(EstadoItem.PREPARANDO)) return EstadoPedido.PREPARANDO;
  if (todos(EstadoItem.PENDIENTE)) return EstadoPedido.PENDIENTE;
  if (todos(EstadoItem.LISTO, EstadoItem.ENTREGADO)) {
    // EN_CAMINO lo marca el despacho de delivery, no los items
    return actual === EstadoPedido.EN_CAMINO ? EstadoPedido.EN_CAMINO : EstadoPedido.LISTO;
  }
  // Mezcla de pendientes con items ya listos o entregados (p. ej. una ronda nueva)
  return EstadoPedido.PREPARANDO;
}

// Tapers automáticos de DELIVERY y PARA_LLEVAR: suma de cantidad × Producto.tapers
// de los items no cancelados. No hace nada en MESA ni si alguien fijó la cantidad
// a mano (tapersManual). Llamar cuando cambian los items, antes de `recalcular`.
export async function recalcularTapers(tx: Tx, pedidoId: string) {
  const pedido = await tx.pedido.findUniqueOrThrow({
    where: { id: pedidoId },
    select: {
      tipo: true,
      tapersManual: true,
      negocio: { select: { precioTaper: true } },
      items: {
        where: { estado: { not: EstadoItem.CANCELADO } },
        select: { cantidad: true, variante: { select: { producto: { select: { tapers: true } } } } },
      },
    },
  });
  if (pedido.tipo === TipoPedido.MESA || pedido.tapersManual) return;

  const cantidadTapers = pedido.items.reduce((suma, i) => suma + i.cantidad * i.variante.producto.tapers, 0);
  await tx.pedido.update({
    where: { id: pedidoId },
    data: { cantidadTapers, cargoTapers: pedido.negocio.precioTaper.times(cantidadTapers) },
  });
}

// Recalcula totales, estado y si quedó pagado. Se llama al final de todo cambio.
// total = subtotal + costoEnvio + cargoTapers - descuento
export async function recalcular(tx: Tx, pedidoId: string) {
  const pedido = await tx.pedido.findUniqueOrThrow({
    where: { id: pedidoId },
    include: {
      items: { where: { estado: { not: EstadoItem.CANCELADO } } },
      pagos: { where: { anuladoEn: null }, select: { monto: true } },
    },
  });

  const estado = calcularEstadoPedido(pedido.estado, pedido.items.map((i) => i.estado));
  // Un pedido cancelado no debe nada: ni envío, ni tapers, ni descuento
  const cancelado = estado === EstadoPedido.CANCELADO;
  const subtotal = sumar(pedido.items.map((i) => i.precioUnitario.times(i.cantidad)));
  const total = cancelado
    ? CERO
    : Prisma.Decimal.max(0, subtotal.plus(pedido.costoEnvio).plus(pedido.cargoTapers).minus(pedido.descuento));

  const totalPagado = sumar(pedido.pagos.map((p) => p.monto));
  if (totalPagado.greaterThan(total)) {
    throw conflicto("TOTAL_MENOR_A_LO_PAGADO", "El total no puede quedar por debajo de lo que ya se pagó", {
      totalPagado: dinero(totalPagado),
    });
  }
  // Queda pagado cuando lo cobrado iguala el total; eso es lo que libera la mesa
  const recienPagado = !pedido.pagado && totalPagado.greaterThan(CERO) && totalPagado.equals(total);
  // La hora de entrega se fija al quedar ENTREGADO y se borra si deja de estarlo
  const entregado = estado === EstadoPedido.ENTREGADO;

  await tx.pedido.update({
    where: { id: pedidoId },
    data: {
      subtotal,
      total,
      estado,
      ...(cancelado ? { costoEnvio: CERO, cantidadTapers: 0, cargoTapers: CERO, descuento: CERO } : {}),
      ...(entregado ? (pedido.entregadoEn ? {} : { entregadoEn: new Date() }) : { entregadoEn: null }),
      ...(recienPagado ? { pagado: true, pagadoEn: new Date() } : {}),
    },
  });
}
