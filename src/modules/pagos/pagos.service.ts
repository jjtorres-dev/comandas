import { EstadoItem, MetodoPago, TipoPedido } from "../../generated/prisma/client";
import { CERO, dinero, sumar } from "../../lib/dinero";
import { conflicto, noEncontrado, solicitudInvalida } from "../../lib/errores";
import { prisma } from "../../lib/prisma";
import { enlaceWhatsapp } from "../../lib/telefono";
import { fechaHoraLocal } from "../../lib/tiempo";
import type { Sesion } from "../../middlewares/auth";
import { bloquearTurnoAbierto, publicarCaja } from "../caja/caja.service";
import {
  bloquearPedido,
  exigirNoCancelado,
  obtenerCompleto,
  publicar,
  recalcular,
} from "../pedidos/pedidos.core";
import type { DatosRegistrarPagos } from "./pagos.schemas";

const NOMBRE_METODO: Record<MetodoPago, string> = {
  EFECTIVO: "Efectivo",
  YAPE: "Yape",
  PLIN: "Plin",
  TARJETA: "Tarjeta",
};

// Pedido con todo lo necesario para la cuenta y la nota de venta. 404 si no es del negocio.
async function cargarCuenta(negocioId: string, pedidoId: string) {
  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId, negocioId },
    include: {
      negocio: { select: { nombre: true } },
      mesa: { select: { nombre: true } },
      cliente: { select: { telefono: true } },
      items: {
        where: { estado: { not: EstadoItem.CANCELADO } },
        orderBy: [{ orden: "asc" }, { creadoEn: "asc" }, { id: "asc" }],
      },
      pagos: { orderBy: { creadoEn: "asc" } },
    },
  });
  if (!pedido) throw noEncontrado("El pedido no existe");

  const totalPagado = sumar(pedido.pagos.map((p) => p.monto));
  return { pedido, totalPagado, saldo: pedido.total.minus(totalPagado) };
}

// Cuenta del pedido: sirve para cobrar y para dividir por platos
export async function obtenerCuenta(negocioId: string, pedidoId: string) {
  const { pedido, totalPagado, saldo } = await cargarCuenta(negocioId, pedidoId);
  const itemsPagados = new Set(pedido.pagos.flatMap((p) => p.itemIds));

  return {
    pedidoId: pedido.id,
    numero: pedido.numero,
    tipo: pedido.tipo,
    items: pedido.items.map((i) => ({
      id: i.id,
      nombreProducto: i.nombreProducto,
      componentes: i.componentes,
      cantidad: i.cantidad,
      precioUnitario: dinero(i.precioUnitario),
      subtotal: dinero(i.precioUnitario.times(i.cantidad)),
      pagado: pedido.pagado || itemsPagados.has(i.id),
    })),
    subtotal: dinero(pedido.subtotal),
    costoEnvio: dinero(pedido.costoEnvio),
    cantidadTapers: pedido.cantidadTapers,
    cargoTapers: dinero(pedido.cargoTapers),
    descuento: dinero(pedido.descuento),
    total: dinero(pedido.total),
    totalPagado: dinero(totalPagado),
    saldoPendiente: dinero(saldo),
    pagado: pedido.pagado,
    pagos: pedido.pagos.map((p) => ({
      id: p.id,
      metodo: p.metodo,
      monto: dinero(p.monto),
      referencia: p.referencia,
      itemIds: p.itemIds,
      creadoEn: p.creadoEn,
    })),
  };
}

// Cobra un pedido: uno o varios pagos (mixto), sobre toda la cuenta o sobre algunos items
export async function registrarPagos(sesion: Sesion, pedidoId: string, datos: DatosRegistrarPagos) {
  const { negocioId } = sesion;
  const itemIds = [...new Set(datos.itemIds ?? [])];
  const suma = sumar(datos.pagos.map((p) => p.monto));

  const resultado = await prisma.$transaction(async (tx) => {
    const pedido = await bloquearPedido(tx, negocioId, pedidoId);
    exigirNoCancelado(pedido);
    if (pedido.pagado) throw conflicto("PEDIDO_PAGADO", "El pedido ya está pagado");

    const turnoId = await bloquearTurnoAbierto(tx, negocioId);
    if (!turnoId) throw conflicto("SIN_CAJA_ABIERTA", "No hay una caja abierta. Abre la caja antes de cobrar");

    const anteriores = await tx.pago.findMany({ where: { pedidoId }, select: { monto: true, itemIds: true } });
    // Primero los items: su error es más preciso que el de saldo
    if (itemIds.length > 0) {
      const items = await tx.pedidoItem.findMany({
        where: { pedidoId, id: { in: itemIds }, estado: { not: EstadoItem.CANCELADO } },
      });
      if (items.length !== itemIds.length) throw noEncontrado("Hay items que no pertenecen a este pedido");

      const yaPagados = new Set(anteriores.flatMap((p) => p.itemIds));
      const repetidos = itemIds.filter((id) => yaPagados.has(id));
      if (repetidos.length > 0) {
        throw conflicto("ITEM_PAGADO", "Hay items que ya fueron pagados", { itemIds: repetidos });
      }

      const subtotalItems = sumar(items.map((i) => i.precioUnitario.times(i.cantidad)));
      if (!suma.equals(subtotalItems)) {
        throw solicitudInvalida(
          `Los pagos (S/ ${dinero(suma)}) deben sumar exactamente lo que cuestan esos items (S/ ${dinero(subtotalItems)})`,
          { subtotalItems: dinero(subtotalItems) },
        );
      }
    }

    const saldo = pedido.total.minus(sumar(anteriores.map((p) => p.monto)));
    if (suma.greaterThan(saldo)) {
      throw conflicto("PAGO_EXCEDE_SALDO", `El pago (S/ ${dinero(suma)}) supera el saldo pendiente (S/ ${dinero(saldo)})`, {
        saldoPendiente: dinero(saldo),
      });
    }

    const pagos = [];
    for (const pago of datos.pagos) {
      const esEfectivo = pago.metodo === MetodoPago.EFECTIVO;
      pagos.push(
        await tx.pago.create({
          data: {
            pedidoId,
            turnoCajaId: turnoId,
            usuarioId: sesion.usuarioId,
            metodo: pago.metodo,
            monto: pago.monto,
            recibido: esEfectivo ? (pago.recibido ?? pago.monto) : null,
            referencia: pago.referencia || null,
            itemIds,
          },
        }),
      );
    }

    // Si con esto se completa el total, el pedido queda pagado y la mesa libre
    await recalcular(tx, pedidoId);
    return { turnoId, pagos, pedido: await obtenerCompleto(tx, pedidoId) };
  });

  const pedido = publicar("pedido:actualizado", resultado.pedido);
  await publicarCaja(negocioId, resultado.turnoId);

  const pagos = resultado.pagos.map((p) => ({
    id: p.id,
    metodo: p.metodo,
    monto: dinero(p.monto),
    recibido: p.recibido ? dinero(p.recibido) : null,
    vuelto: dinero(p.recibido ? p.recibido.minus(p.monto) : CERO),
    referencia: p.referencia,
  }));
  return {
    pedido,
    pagos,
    vuelto: dinero(sumar(resultado.pagos.map((p) => (p.recibido ? p.recibido.minus(p.monto) : CERO)))),
    saldoPendiente: pedido.saldoPendiente,
  };
}

// Nota de venta en texto plano para enviar por WhatsApp (*negrita* de WhatsApp)
export async function notaDeVenta(negocioId: string, pedidoId: string) {
  const { pedido, totalPagado, saldo } = await cargarCuenta(negocioId, pedidoId);
  const soles = (monto: Parameters<typeof dinero>[0]) => `S/ ${dinero(monto)}`;

  const lineas = [
    `*${pedido.negocio.nombre}*`,
    `Nota de venta - Pedido #${pedido.numero}`,
    fechaHoraLocal(pedido.creadoEn),
  ];

  if (pedido.tipo === TipoPedido.MESA) lineas.push(pedido.mesa?.nombre ?? "Mesa");
  if (pedido.tipo === TipoPedido.PARA_LLEVAR) lineas.push("Para llevar");
  if (pedido.tipo === TipoPedido.DELIVERY) lineas.push(`Delivery: ${pedido.direccionEntrega}`);
  if (pedido.nombreCliente) lineas.push(`Cliente: ${pedido.nombreCliente}`);

  lineas.push("");
  for (const item of pedido.items) {
    lineas.push(`${item.cantidad} x ${item.nombreProducto}: ${soles(item.precioUnitario.times(item.cantidad))}`);
    if (item.componentes.length > 0) lineas.push(`   (${item.componentes.join(" + ")})`);
  }

  lineas.push("", `Subtotal: ${soles(pedido.subtotal)}`);
  if (pedido.costoEnvio.greaterThan(CERO)) lineas.push(`Envío: ${soles(pedido.costoEnvio)}`);
  if (pedido.cantidadTapers > 0) lineas.push(`Tapers (${pedido.cantidadTapers}): ${soles(pedido.cargoTapers)}`);
  if (pedido.descuento.greaterThan(CERO)) lineas.push(`Descuento: -${soles(pedido.descuento)}`);
  lineas.push(`*TOTAL: ${soles(pedido.total)}*`, "");

  if (pedido.pagos.length === 0) {
    lineas.push("Pago: pendiente");
  } else {
    // Un renglón por método, sumando si se usó más de una vez
    const porMetodo = new Map<MetodoPago, typeof CERO>();
    for (const pago of pedido.pagos) porMetodo.set(pago.metodo, (porMetodo.get(pago.metodo) ?? CERO).plus(pago.monto));
    lineas.push(`Pago: ${[...porMetodo].map(([metodo, monto]) => `${NOMBRE_METODO[metodo]} ${soles(monto)}`).join(" + ")}`);
    if (saldo.greaterThan(CERO)) lineas.push(`Pagado: ${soles(totalPagado)} - Saldo: ${soles(saldo)}`);
  }

  lineas.push("", "No es comprobante electrónico", "¡Gracias por su preferencia!");

  const texto = lineas.join("\n");
  const telefono = pedido.telefonoCliente ?? pedido.cliente?.telefono ?? null;
  return { texto, whatsappUrl: telefono ? enlaceWhatsapp(telefono, texto) : null };
}
