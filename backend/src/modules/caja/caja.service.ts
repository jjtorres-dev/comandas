import { EstadoPedido, MetodoPago, Prisma } from "../../generated/prisma/client.js";
import { CERO, dinero, sumar } from "../../lib/dinero.js";
import { conflicto } from "../../lib/errores.js";
import { prisma, type Tx } from "../../lib/prisma.js";
import type { Sesion } from "../../middlewares/auth.js";
import { emitirANegocio } from "../../realtime/socket.js";
import { bloquearNegocio } from "../pedidos/pedidos.core.js";
import type { DatosAbrirCaja, DatosCerrarCaja } from "./caja.schemas.js";

export const incluirTurno = {
  abiertoPor: { select: { id: true, nombre: true } },
  cerradoPor: { select: { id: true, nombre: true } },
  pagos: { select: { pedidoId: true, metodo: true, monto: true, recibido: true, anuladoEn: true } },
} satisfies Prisma.TurnoCajaInclude;

type TurnoCompleto = Prisma.TurnoCajaGetPayload<{ include: typeof incluirTurno }>;

// Turno con su resumen. `monto` ya es neto de vuelto, así que el efectivo
// esperado en el cajón es montoInicial + efectivo cobrado.
export function resumir(turno: TurnoCompleto) {
  // Los pagos anulados siguen guardados, pero no cuentan en ningún total
  const pagos = turno.pagos.filter((p) => p.anuladoEn === null);
  const porMetodo = (metodo: MetodoPago) => sumar(pagos.filter((p) => p.metodo === metodo).map((p) => p.monto));

  const efectivoCobrado = porMetodo(MetodoPago.EFECTIVO);
  const efectivoEsperado = turno.montoInicial.plus(efectivoCobrado);
  const vuelto = sumar(pagos.map((p) => (p.recibido ? p.recibido.minus(p.monto) : CERO)));

  return {
    id: turno.id,
    abierto: turno.cerradoEn === null,
    abiertoEn: turno.abiertoEn,
    abiertoPor: turno.abiertoPor,
    cerradoEn: turno.cerradoEn,
    cerradoPor: turno.cerradoPor,
    montoInicial: dinero(turno.montoInicial),
    totalesPorMetodo: {
      EFECTIVO: dinero(efectivoCobrado),
      YAPE: dinero(porMetodo(MetodoPago.YAPE)),
      PLIN: dinero(porMetodo(MetodoPago.PLIN)),
      TARJETA: dinero(porMetodo(MetodoPago.TARJETA)),
    },
    totalCobrado: dinero(sumar(pagos.map((p) => p.monto))),
    pedidosCobrados: new Set(pagos.map((p) => p.pedidoId)).size,
    pagosAnulados: turno.pagos.length - pagos.length,
    vueltoEntregado: dinero(vuelto),
    efectivoEsperado: dinero(efectivoEsperado),
    // Solo tras el cierre
    efectivoContado: turno.efectivoContado ? dinero(turno.efectivoContado) : null,
    diferencia: turno.efectivoContado ? dinero(turno.efectivoContado.minus(efectivoEsperado)) : null,
    observacion: turno.observacion,
  };
}

const obtenerTurno = (tx: Tx, turnoId: string) =>
  tx.turnoCaja.findUniqueOrThrow({ where: { id: turnoId }, include: incluirTurno });

// Bloquea el turno abierto del negocio (si hay) para que no se cierre mientras
// se registra un pago, ni se cobre sobre un turno que se está cerrando
export async function bloquearTurnoAbierto(tx: Tx, negocioId: string): Promise<string | null> {
  const filas = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM "TurnoCaja" WHERE "negocioId" = ${negocioId} AND "cerradoEn" IS NULL FOR UPDATE`;
  return filas[0]?.id ?? null;
}

// Resumen del turno para avisar a los demás dispositivos. Llamar después del commit.
export async function publicarCaja(negocioId: string, turnoId: string) {
  const turno = resumir(await obtenerTurno(prisma, turnoId));
  emitirANegocio(negocioId, "caja:actualizada", turno);
  return turno;
}

export async function abrirCaja(sesion: Sesion, datos: DatosAbrirCaja) {
  const { negocioId } = sesion;

  const turnoId = await prisma.$transaction(async (tx) => {
    await bloquearNegocio(tx, negocioId); // dos aperturas simultáneas: solo entra una
    const abierto = await bloquearTurnoAbierto(tx, negocioId);
    if (abierto) throw conflicto("CAJA_YA_ABIERTA", "Ya hay una caja abierta. Ciérrala antes de abrir otra", { turnoId: abierto });

    const turno = await tx.turnoCaja.create({
      data: { negocioId, abiertoPorId: sesion.usuarioId, montoInicial: datos.montoInicial },
    });
    return turno.id;
  });

  return publicarCaja(negocioId, turnoId);
}

// Turno abierto con su resumen, o null si la caja está cerrada
export async function cajaActual(negocioId: string) {
  const turno = await prisma.turnoCaja.findFirst({
    where: { negocioId, cerradoEn: null },
    include: incluirTurno,
  });
  return turno ? resumir(turno) : null;
}

export async function cerrarCaja(sesion: Sesion, datos: DatosCerrarCaja) {
  const { negocioId } = sesion;

  const cierre = await prisma.$transaction(async (tx) => {
    const turnoId = await bloquearTurnoAbierto(tx, negocioId);
    if (!turnoId) throw conflicto("SIN_CAJA_ABIERTA", "No hay una caja abierta");

    await tx.turnoCaja.update({
      where: { id: turnoId },
      data: {
        cerradoEn: new Date(),
        cerradoPorId: sesion.usuarioId,
        efectivoContado: datos.efectivoContado,
        observacion: datos.observacion || null,
      },
    });

    // Pedidos cobrados a medias: se avisa, pero no impiden cerrar
    const parciales = await tx.pedido.findMany({
      where: { negocioId, pagado: false, estado: { not: EstadoPedido.CANCELADO }, pagos: { some: { anuladoEn: null } } },
      orderBy: { creadoEn: "asc" },
      include: { pagos: { where: { anuladoEn: null }, select: { monto: true } } },
    });

    return {
      turnoId,
      pedidosConPagoParcial: parciales.map((p) => {
        const pagado = sumar(p.pagos.map((pago) => pago.monto));
        return {
          id: p.id,
          numero: p.numero,
          total: dinero(p.total),
          totalPagado: dinero(pagado),
          saldoPendiente: dinero(p.total.minus(pagado)),
        };
      }),
    };
  });

  const turno = await publicarCaja(negocioId, cierre.turnoId);
  const pendientes = cierre.pedidosConPagoParcial.length;
  return {
    turno,
    pedidosConPagoParcial: cierre.pedidosConPagoParcial,
    aviso:
      pendientes > 0
        ? `La caja se cerró con ${pendientes} pedido(s) con pago parcial pendiente de cobrar`
        : null,
  };
}

// Pedidos con algún pago en el turno abierto, del cobro más reciente al más
// antiguo. Incluye los pagos anulados (marcados): es la pantalla para
// corregir un cobro o reenviar una nota de venta antes de cerrar la caja.
export async function cobradosDelTurno(negocioId: string) {
  const turno = await prisma.turnoCaja.findFirst({ where: { negocioId, cerradoEn: null }, select: { id: true } });
  if (!turno) return [];

  const pedidos = await prisma.pedido.findMany({
    where: { negocioId, pagos: { some: { turnoCajaId: turno.id } } },
    include: {
      mesa: { select: { id: true, nombre: true } },
      // Todos los pagos vivos del pedido dan el saldo; los de este turno se listan
      pagos: { orderBy: { creadoEn: "asc" }, include: { anuladoPor: { select: { id: true, nombre: true } } } },
    },
  });

  return pedidos
    .map((pedido) => {
      const delTurno = pedido.pagos.filter((p) => p.turnoCajaId === turno.id);
      const totalPagado = sumar(pedido.pagos.filter((p) => p.anuladoEn === null).map((p) => p.monto));
      return {
        pedido: {
          id: pedido.id,
          numero: pedido.numero,
          tipo: pedido.tipo,
          mesa: pedido.mesa,
          cliente: pedido.nombreCliente || pedido.telefonoCliente ? { nombre: pedido.nombreCliente, telefono: pedido.telefonoCliente } : null,
          total: dinero(pedido.total),
          totalPagado: dinero(totalPagado),
          saldoPendiente: dinero(Prisma.Decimal.max(0, pedido.total.minus(totalPagado))),
          pagado: pedido.pagado,
        },
        pagos: delTurno.map(serializarPago),
        ultimoPagoEn: delTurno[delTurno.length - 1].creadoEn,
      };
    })
    .sort((a, b) => b.ultimoPagoEn.getTime() - a.ultimoPagoEn.getTime());
}

type PagoConAnulador = Prisma.PagoGetPayload<{ include: { anuladoPor: { select: { id: true; nombre: true } } } }>;

// Forma en que un pago viaja en la cuenta y en los cobrados del turno
export function serializarPago(p: PagoConAnulador) {
  return {
    id: p.id,
    metodo: p.metodo,
    monto: dinero(p.monto),
    recibido: p.recibido ? dinero(p.recibido) : null,
    vuelto: dinero(p.recibido ? p.recibido.minus(p.monto) : CERO),
    referencia: p.referencia,
    itemIds: p.itemIds,
    creadoEn: p.creadoEn,
    anulado: p.anuladoEn !== null,
    anuladoEn: p.anuladoEn,
    anuladoPor: p.anuladoPor,
    motivoAnulacion: p.motivoAnulacion,
  };
}
