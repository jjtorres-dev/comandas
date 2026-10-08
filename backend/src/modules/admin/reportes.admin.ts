// Reportes del dueño. "Ventas" es lo cobrado en esos días (pagos vigentes por
// su fecha de cobro); lo pedido y todavía sin cobrar va aparte, como "por cobrar".
import { EstadoItem, EstadoPedido, MetodoPago, Prisma, TipoPedido } from "../../generated/prisma/client";
import { CERO, dinero, sumar } from "../../lib/dinero";
import { prisma } from "../../lib/prisma";
import { diaYHora, inicioDeFecha } from "../../lib/tiempo";
import { incluirTurno, resumir } from "../caja/caja.service";
import type { Rango } from "./admin.schemas";

const UN_DIA = 86_400_000;
const PLATOS_EN_LA_LISTA = 10;

// Todos los días del rango, para que un día sin ventas salga en cero y no falte
function diasDe({ desde, hasta }: Rango): string[] {
  const dias: string[] = [];
  for (let t = Date.parse(desde); t <= Date.parse(hasta); t += UN_DIA) dias.push(new Date(t).toISOString().slice(0, 10));
  return dias;
}

const minutos = (ms: number) => Math.round((ms / 60_000) * 10) / 10;

export async function reporte(negocioId: string, rango: Rango) {
  const inicio = inicioDeFecha(rango.desde);
  const fin = new Date(inicioDeFecha(rango.hasta).getTime() + UN_DIA);
  const enRango = { gte: inicio, lt: fin };

  const [pagos, pedidos, items, turnos, cambios] = await Promise.all([
    prisma.pago.findMany({
      where: { anuladoEn: null, creadoEn: enRango, pedido: { negocioId } },
      select: { pedidoId: true, metodo: true, monto: true, creadoEn: true, pedido: { select: { tipo: true } } },
    }),
    // Lo pedido en esos días (sin lo cancelado): por hora y lo que falta cobrar
    prisma.pedido.findMany({
      where: { negocioId, creadoEn: enRango, estado: { not: EstadoPedido.CANCELADO } },
      select: { creadoEn: true, total: true, pagado: true, pagos: { where: { anuladoEn: null }, select: { monto: true } } },
    }),
    prisma.pedidoItem.findMany({
      where: { creadoEn: enRango, estado: { not: EstadoItem.CANCELADO }, pedido: { negocioId } },
      select: { nombreProducto: true, cantidad: true, precioUnitario: true, creadoEn: true, listoEn: true, area: { select: { id: true, nombre: true } } },
    }),
    prisma.turnoCaja.findMany({ where: { negocioId, abiertoEn: enRango }, orderBy: { abiertoEn: "desc" }, include: incluirTurno }),
    prisma.pagoCambio.findMany({
      where: { creadoEn: enRango, pago: { pedido: { negocioId } } },
      orderBy: { creadoEn: "desc" },
      select: {
        id: true,
        tipo: true,
        detalle: true,
        creadoEn: true,
        usuario: { select: { nombre: true } },
        pago: { select: { monto: true, pedido: { select: { id: true, numero: true } } } },
      },
    }),
  ]);

  // ---------- Ventas (lo cobrado) ----------
  const total = sumar(pagos.map((p) => p.monto));
  const pedidosCobrados = new Set(pagos.map((p) => p.pedidoId)).size;
  const suma = <C extends string>(claves: readonly C[], de: (p: (typeof pagos)[number]) => C) =>
    Object.fromEntries(claves.map((c) => [c, dinero(sumar(pagos.filter((p) => de(p) === c).map((p) => p.monto)))])) as Record<C, string>;

  const porDia = new Map(diasDe(rango).map((dia) => [dia, { total: CERO as Prisma.Decimal, pedidos: new Set<string>() }]));
  for (const p of pagos) {
    const dia = porDia.get(diaYHora(p.creadoEn).dia);
    if (!dia) continue;
    dia.total = dia.total.plus(p.monto);
    dia.pedidos.add(p.pedidoId);
  }

  // ---------- Por cobrar ----------
  const pendientes = pedidos.filter((p) => !p.pagado && p.total.gt(0));
  const porCobrar = sumar(pendientes.map((p) => p.total.minus(sumar(p.pagos.map((x) => x.monto)))));

  // ---------- Platos ----------
  const platos = new Map<string, { cantidad: number; total: Prisma.Decimal }>();
  for (const i of items) {
    const plato = platos.get(i.nombreProducto) ?? { cantidad: 0, total: CERO };
    platos.set(i.nombreProducto, { cantidad: plato.cantidad + i.cantidad, total: plato.total.plus(i.precioUnitario.times(i.cantidad)) });
  }

  // ---------- Pedidos por hora ----------
  const porHora = Array.from({ length: 24 }, (_, hora) => ({ hora, pedidos: 0 }));
  for (const p of pedidos) porHora[diaYHora(p.creadoEn).hora].pedidos += 1;

  // ---------- Cocina: de que se pide a que está listo ----------
  const listos = items.filter((i) => i.listoEn !== null);
  const promedio = (lista: typeof listos) =>
    lista.length === 0 ? null : minutos(lista.reduce((ms, i) => ms + (i.listoEn!.getTime() - i.creadoEn.getTime()), 0) / lista.length);
  const areas = new Map<string, { nombre: string; items: typeof listos }>();
  for (const i of listos) {
    const area = areas.get(i.area.id) ?? { nombre: i.area.nombre, items: [] };
    area.items.push(i);
    areas.set(i.area.id, area);
  }

  return {
    desde: rango.desde,
    hasta: rango.hasta,
    ventas: {
      total: dinero(total),
      pedidos: pedidosCobrados,
      ticketPromedio: dinero(pedidosCobrados === 0 ? CERO : total.dividedBy(pedidosCobrados)),
      porMetodo: suma(Object.values(MetodoPago), (p) => p.metodo),
      porTipo: suma(Object.values(TipoPedido), (p) => p.pedido.tipo),
      porDia: [...porDia].map(([fecha, d]) => ({ fecha, total: dinero(d.total), pedidos: d.pedidos.size })),
    },
    porCobrar: { total: dinero(porCobrar), pedidos: pendientes.length },
    pedidosTomados: pedidos.length,
    platos: [...platos]
      .map(([nombre, p]) => ({ nombre, cantidad: p.cantidad, total: dinero(p.total) }))
      .sort((a, b) => b.cantidad - a.cantidad || a.nombre.localeCompare(b.nombre))
      .slice(0, PLATOS_EN_LA_LISTA),
    porHora,
    cocina: {
      promedioMin: promedio(listos),
      platos: listos.length,
      porArea: [...areas.values()]
        .map((a) => ({ area: a.nombre, promedioMin: promedio(a.items), platos: a.items.length }))
        .sort((a, b) => a.area.localeCompare(b.area)),
    },
    turnos: turnos.map(resumir),
    correcciones: cambios.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      detalle: c.detalle,
      creadoEn: c.creadoEn,
      usuario: c.usuario.nombre,
      monto: dinero(c.pago.monto),
      pedido: c.pago.pedido,
    })),
  };
}
