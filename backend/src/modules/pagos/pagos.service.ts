import { randomUUID } from "node:crypto";
import { EstadoItem, MetodoPago, Prisma, TipoPedido } from "../../generated/prisma/client.js";
import { CERO, dinero, sumar } from "../../lib/dinero.js";
import { conflicto, noEncontrado, solicitudInvalida } from "../../lib/errores.js";
import { prisma, type Tx } from "../../lib/prisma.js";
import { enlaceWhatsapp } from "../../lib/telefono.js";
import { fechaHoraLocal } from "../../lib/tiempo.js";
import type { Sesion } from "../../middlewares/auth.js";
import { bloquearTurnoAbierto, publicarCaja, serializarPago } from "../caja/caja.service.js";
import {
  bloquearPedido,
  exigirNoCancelado,
  obtenerCompleto,
  type PedidoCompleto,
  publicar,
  recalcular,
  serializar,
} from "../pedidos/pedidos.core.js";
import type { DatosAnularPago, DatosCambiarMetodo, DatosRegistrarPagos } from "./pagos.schemas.js";

const NOMBRE_METODO: Record<MetodoPago, string> = {
  EFECTIVO: "Efectivo",
  YAPE: "Yape",
  PLIN: "Plin",
  TARJETA: "Tarjeta",
};

type PagoDeCuenta = { grupoId: string; itemIds: string[]; unidades: Prisma.JsonValue; anuladoEn: Date | null };

// Cuántas unidades de cada item están cobradas. Los pagos de un mismo cobro
// (pago mixto) comparten grupo y cuentan una sola vez; un grupo deja de contar
// cuando todos sus pagos están anulados. Los pagos antiguos (sin `unidades`)
// cubren el item entero.
function unidadesPagadas(items: { id: string; cantidad: number }[], pagos: PagoDeCuenta[]): Map<string, number> {
  const grupos = new Map<string, PagoDeCuenta>();
  for (const pago of pagos) {
    if (pago.anuladoEn === null && !grupos.has(pago.grupoId)) grupos.set(pago.grupoId, pago);
  }
  return new Map(
    items.map((item) => {
      let pagadas = 0;
      for (const grupo of grupos.values()) {
        const porUnidad = (grupo.unidades as Record<string, number> | null)?.[item.id];
        pagadas += porUnidad ?? (grupo.itemIds.includes(item.id) ? item.cantidad : 0);
      }
      return [item.id, Math.min(item.cantidad, pagadas)];
    }),
  );
}

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
      pagos: { orderBy: { creadoEn: "asc" }, include: { anuladoPor: { select: { id: true, nombre: true } } } },
    },
  });
  if (!pedido) throw noEncontrado("El pedido no existe");

  // Los anulados se muestran en la cuenta, pero no cuentan
  const vigentes = pedido.pagos.filter((p) => p.anuladoEn === null);
  const totalPagado = sumar(vigentes.map((p) => p.monto));
  return { pedido, vigentes, totalPagado, saldo: pedido.total.minus(totalPagado) };
}

// Cuenta del pedido: sirve para cobrar y para dividir por platos
export async function obtenerCuenta(negocioId: string, pedidoId: string) {
  const { pedido, totalPagado, saldo } = await cargarCuenta(negocioId, pedidoId);
  const pagadas = unidadesPagadas(pedido.items, pedido.pagos);
  const turno = await prisma.turnoCaja.findFirst({ where: { negocioId, cerradoEn: null }, select: { id: true } });

  return {
    pedidoId: pedido.id,
    numero: pedido.numero,
    tipo: pedido.tipo,
    items: pedido.items.map((i) => {
      const cantidadPagada = pedido.pagado ? i.cantidad : (pagadas.get(i.id) ?? 0);
      return {
        id: i.id,
        nombreProducto: i.nombreProducto,
        componentes: i.componentes,
        cantidad: i.cantidad,
        precioUnitario: dinero(i.precioUnitario),
        subtotal: dinero(i.precioUnitario.times(i.cantidad)),
        cantidadPagada,
        pagado: cantidadPagada >= i.cantidad,
      };
    }),
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
      ...serializarPago(p),
      // Solo los pagos del turno abierto se pueden corregir
      corregible: p.anuladoEn === null && p.turnoCajaId === turno?.id,
    })),
  };
}

// Cobra un pedido: uno o varios pagos (mixto), sobre toda la cuenta, sobre
// algunos items enteros (itemIds) o sobre algunas unidades (items)
export async function registrarPagos(sesion: Sesion, pedidoId: string, datos: DatosRegistrarPagos) {
  const { negocioId } = sesion;
  const suma = sumar(datos.pagos.map((p) => p.monto));
  const idsPedidos = [...new Set(datos.items?.map((i) => i.itemId) ?? datos.itemIds ?? [])];

  const resultado = await prisma.$transaction(async (tx) => {
    const pedido = await bloquearPedido(tx, negocioId, pedidoId);

    // Idempotencia: si este cobro ya entró (la respuesta se perdió y la caja
    // reintenta), se devuelve lo que se registró, sin cobrar otra vez
    if (datos.idCobro) {
      const yaCobrado = await tx.pago.findMany({ where: { pedidoId, grupoId: datos.idCobro }, orderBy: { creadoEn: "asc" } });
      if (yaCobrado.length > 0) {
        return { turnoId: yaCobrado[0].turnoCajaId, pagos: yaCobrado, pedido: await obtenerCompleto(tx, pedidoId), creado: false };
      }
    }

    exigirNoCancelado(pedido);
    if (pedido.pagado) throw conflicto("PEDIDO_PAGADO", "El pedido ya está pagado");

    const turnoId = await bloquearTurnoAbierto(tx, negocioId);
    if (!turnoId) throw conflicto("SIN_CAJA_ABIERTA", "No hay una caja abierta. Abre la caja antes de cobrar");

    const anteriores = await tx.pago.findMany({
      where: { pedidoId, anuladoEn: null },
      select: { monto: true, itemIds: true, unidades: true, grupoId: true, anuladoEn: true },
    });

    // Primero los items: su error es más preciso que el de saldo
    let unidades: Record<string, number> | null = null;
    if (idsPedidos.length > 0) {
      const items = await tx.pedidoItem.findMany({
        where: { pedidoId, id: { in: idsPedidos }, estado: { not: EstadoItem.CANCELADO } },
      });
      if (items.length !== idsPedidos.length) throw noEncontrado("Hay items que no pertenecen a este pedido");

      const pagadas = unidadesPagadas(items, anteriores);
      // itemIds = el item entero; items = las unidades que se indiquen
      const pedidas = new Map(datos.items?.map((i) => [i.itemId, i.cantidad]) ?? items.map((i) => [i.id, i.cantidad]));
      const sinCupo = items.filter((i) => {
        const libres = i.cantidad - (pagadas.get(i.id) ?? 0);
        // Con itemIds, un item con alguna unidad ya cobrada no se puede cobrar "entero"
        return datos.items ? pedidas.get(i.id)! > libres : libres < i.cantidad;
      });
      if (sinCupo.length > 0) {
        throw conflicto("ITEM_PAGADO", "Hay items (o unidades) que ya fueron pagados", { itemIds: sinCupo.map((i) => i.id) });
      }

      const subtotalItems = sumar(items.map((i) => i.precioUnitario.times(pedidas.get(i.id)!)));
      if (!suma.equals(subtotalItems)) {
        throw solicitudInvalida(
          `Los pagos (S/ ${dinero(suma)}) deben sumar exactamente lo que cuestan esos items (S/ ${dinero(subtotalItems)})`,
          { subtotalItems: dinero(subtotalItems) },
        );
      }
      unidades = Object.fromEntries(pedidas);
    }

    const saldo = pedido.total.minus(sumar(anteriores.map((p) => p.monto)));
    if (suma.greaterThan(saldo)) {
      throw conflicto("PAGO_EXCEDE_SALDO", `El pago (S/ ${dinero(suma)}) supera el saldo pendiente (S/ ${dinero(saldo)})`, {
        saldoPendiente: dinero(saldo),
      });
    }

    // Los pagos de este cobro comparten grupo: sus items cuentan una sola vez
    const grupoId = datos.idCobro ?? randomUUID();
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
            itemIds: idsPedidos,
            unidades: unidades ?? Prisma.DbNull,
            grupoId,
          },
        }),
      );
    }

    // Si con esto se completa el total, el pedido queda pagado y la mesa libre
    await recalcular(tx, pedidoId);
    return { turnoId, pagos, pedido: await obtenerCompleto(tx, pedidoId), creado: true };
  });

  // Un reintento no vuelve a avisar a los demás equipos
  const pedido = resultado.creado ? publicar("pedido:actualizado", resultado.pedido) : serializar(resultado.pedido);
  // El cobro ya está guardado: un fallo al avisar no puede convertirlo en un error
  if (resultado.creado) await publicarCaja(negocioId, resultado.turnoId).catch(() => undefined);

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
    creado: resultado.creado,
  };
}

// El pago a corregir: del pedido, vigente y del turno que sigue abierto.
// Bloquea el pedido y el turno para que nada cambie mientras tanto.
async function pagoCorregible(tx: Tx, negocioId: string, pedidoId: string, pagoId: string) {
  const pedido = await bloquearPedido(tx, negocioId, pedidoId);
  const turnoId = await bloquearTurnoAbierto(tx, negocioId);
  const pago = await tx.pago.findFirst({ where: { id: pagoId, pedidoId } });
  if (!pago) throw noEncontrado("El pago no existe en este pedido");
  if (pago.anuladoEn) throw conflicto("PAGO_ANULADO", "Ese pago ya está anulado");
  // Después de cerrar la caja no se toca nada: el cierre ya se contó con esos pagos
  if (pago.turnoCajaId !== turnoId) {
    throw conflicto("TURNO_CERRADO", "Ese pago es de una caja ya cerrada: no se puede corregir");
  }
  return { pedido, pago, turnoId };
}

const respuestaDeCorreccion = async (negocioId: string, turnoId: string, pedido: PedidoCompleto, pagoId: string) => {
  const pago = await prisma.pago.findUniqueOrThrow({ where: { id: pagoId }, include: { anuladoPor: { select: { id: true, nombre: true } } } });
  const serializado = publicar("pedido:actualizado", pedido);
  const turno = await publicarCaja(negocioId, turnoId);
  return { pedido: serializado, pago: serializarPago(pago), turno };
};

// Se cobró bien pero se anotó con otro método (era efectivo y se marcó Yape).
// El monto no cambia; queda registrado quién lo cambió y qué había antes.
export async function cambiarMetodo(sesion: Sesion, pedidoId: string, pagoId: string, datos: DatosCambiarMetodo) {
  const { negocioId } = sesion;
  const esEfectivo = datos.metodo === MetodoPago.EFECTIVO;

  const resultado = await prisma.$transaction(async (tx) => {
    const { pago, turnoId } = await pagoCorregible(tx, negocioId, pedidoId, pagoId);

    if (datos.recibido !== undefined && !esEfectivo) {
      throw solicitudInvalida("Solo los pagos en efectivo llevan recibido");
    }
    if (datos.recibido?.lessThan(pago.monto)) {
      throw solicitudInvalida("Lo recibido no puede ser menor que el monto del pago");
    }
    const despues = {
      metodo: datos.metodo,
      recibido: esEfectivo ? (datos.recibido ?? pago.monto) : null,
      // Si no se envía referencia, se conserva la que tenía
      referencia: datos.referencia === undefined ? pago.referencia : datos.referencia || null,
    };
    const antes = { metodo: pago.metodo, recibido: pago.recibido, referencia: pago.referencia };
    const igual =
      antes.metodo === despues.metodo &&
      antes.referencia === despues.referencia &&
      (antes.recibido === null ? despues.recibido === null : despues.recibido !== null && antes.recibido.equals(despues.recibido));
    if (igual) throw solicitudInvalida("El pago ya tiene ese método");

    await tx.pago.update({ where: { id: pagoId }, data: despues });
    await tx.pagoCambio.create({
      data: {
        pagoId,
        usuarioId: sesion.usuarioId,
        tipo: "METODO",
        detalle: {
          antes: { ...antes, recibido: antes.recibido ? dinero(antes.recibido) : null },
          despues: { ...despues, recibido: despues.recibido ? dinero(despues.recibido) : null },
        },
      },
    });
    return { turnoId, pedido: await obtenerCompleto(tx, pedidoId) };
  });

  return respuestaDeCorreccion(negocioId, resultado.turnoId, resultado.pedido, pagoId);
}

// El pago estuvo mal (monto equivocado, pedido equivocado). No se borra: queda
// marcado como anulado, deja de contar en todos los totales y el pedido vuelve
// a tener saldo pendiente.
export async function anularPago(sesion: Sesion, pedidoId: string, pagoId: string, datos: DatosAnularPago) {
  const { negocioId } = sesion;

  const resultado = await prisma.$transaction(async (tx) => {
    const { pedido, pago, turnoId } = await pagoCorregible(tx, negocioId, pedidoId, pagoId);

    await tx.pago.update({
      where: { id: pagoId },
      data: { anuladoEn: new Date(), anuladoPorId: sesion.usuarioId, motivoAnulacion: datos.motivo },
    });
    await tx.pagoCambio.create({
      data: {
        pagoId,
        usuarioId: sesion.usuarioId,
        tipo: "ANULACION",
        detalle: { motivo: datos.motivo, metodo: pago.metodo, monto: dinero(pago.monto) },
      },
    });

    if (pedido.pagado) {
      // La cuenta se reabre, pero el pedido nunca vuelve a ocupar su mesa: al
      // pagarse la mesa quedó libre, y un pedido nuevo ahí no debe entrar como
      // ronda de este. Sigue en "por cobrar" como "cuenta reabierta".
      await tx.pedido.update({
        where: { id: pedidoId },
        data: { pagado: false, pagadoEn: null, ...(pedido.mesaId !== null ? { mesaLiberada: true } : {}) },
      });
    }
    await recalcular(tx, pedidoId);
    return { turnoId, pedido: await obtenerCompleto(tx, pedidoId) };
  });

  return respuestaDeCorreccion(negocioId, resultado.turnoId, resultado.pedido, pagoId);
}

// Nota de venta en texto plano para enviar por WhatsApp (*negrita* de WhatsApp)
export async function notaDeVenta(negocioId: string, pedidoId: string) {
  const { pedido, vigentes, totalPagado, saldo } = await cargarCuenta(negocioId, pedidoId);
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

  if (vigentes.length === 0) {
    lineas.push("Pago: pendiente");
  } else {
    // Un renglón por método, sumando si se usó más de una vez
    const porMetodo = new Map<MetodoPago, typeof CERO>();
    for (const pago of vigentes) porMetodo.set(pago.metodo, (porMetodo.get(pago.metodo) ?? CERO).plus(pago.monto));
    lineas.push(`Pago: ${[...porMetodo].map(([metodo, monto]) => `${NOMBRE_METODO[metodo]} ${soles(monto)}`).join(" + ")}`);
    if (saldo.greaterThan(CERO)) lineas.push(`Pagado: ${soles(totalPagado)} - Saldo: ${soles(saldo)}`);
  }

  lineas.push("", "No es comprobante electrónico", "¡Gracias por su preferencia!");

  const texto = lineas.join("\n");
  const telefono = pedido.telefonoCliente ?? pedido.cliente?.telefono ?? null;
  return { texto, whatsappUrl: telefono ? enlaceWhatsapp(telefono, texto) : null };
}
