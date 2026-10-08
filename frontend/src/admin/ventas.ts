// Arma lo que muestra la pestaña Ventas a partir del reporte del servidor.
// Funciones puras: aquí no se suma dinero, solo se le da forma.
import { plural, soles } from "../lib/formato";
import type { Correccion, MetodoPago, Reporte, TipoPedido, Turno } from "../lib/tipos";
import { nombreDeMetodo } from "../local/dinero";
import { fechaCorta, fechaLarga, mesAbreviado, nombreDeMes } from "./periodos";

type Dato = { clave: string; eje: string; nombre: string; valor: number; texto: string };

// Con muchos días, una columna por día no se lee: se junta por mes
const DIAS_PARA_JUNTAR_POR_MES = 62;

export function ventasPorDia(porDia: Reporte["ventas"]["porDia"]): { datos: Dato[]; categoria: string } {
  if (porDia.length > DIAS_PARA_JUNTAR_POR_MES) {
    const meses = new Map<string, number>();
    // Se suma en céntimos enteros para no arrastrar decimales
    for (const d of porDia) meses.set(d.fecha.slice(0, 7), (meses.get(d.fecha.slice(0, 7)) ?? 0) + Math.round(Number(d.total) * 100));
    return {
      categoria: "Mes",
      datos: [...meses].map(([mes, centimos]) => ({ clave: mes, eje: mesAbreviado(`${mes}-01`), nombre: nombreDeMes(`${mes}-01`), valor: centimos, texto: soles(centimos / 100) })),
    };
  }
  // Hasta 10 días cabe "mié 7"; con más, solo el número y salteado
  const cada = porDia.length <= 10 ? 1 : porDia.length <= 16 ? 2 : 5;
  return {
    categoria: "Día",
    datos: porDia.map((d, i) => ({
      clave: d.fecha,
      eje: porDia.length <= 10 ? fechaCorta(d.fecha) : i % cada === 0 ? String(Number(d.fecha.slice(8))) : "",
      nombre: fechaLarga(d.fecha),
      valor: Number(d.total),
      texto: soles(d.total),
    })),
  };
}

const hora = (h: number) => `${h}:00`;

// Solo las horas en las que el local trabajó: de la primera con pedidos a la última
export function pedidosPorHora(porHora: Reporte["porHora"]): Dato[] {
  const conPedidos = porHora.filter((h) => h.pedidos > 0).map((h) => h.hora);
  if (conPedidos.length === 0) return [];
  const [desde, hasta] = [Math.min(...conPedidos), Math.max(...conPedidos)];
  const tramo = porHora.filter((h) => h.hora >= Math.max(0, desde - 1) && h.hora <= Math.min(23, hasta + 1));
  const cada = tramo.length <= 8 ? 1 : 2;
  return tramo.map((h, i) => ({
    clave: String(h.hora),
    eje: i % cada === 0 ? `${h.hora} h` : "",
    nombre: `De ${hora(h.hora)} a ${hora(h.hora + 1)}`,
    valor: h.pedidos,
    texto: plural(h.pedidos, "pedido", "pedidos"),
  }));
}

const METODOS: MetodoPago[] = ["EFECTIVO", "YAPE", "PLIN", "TARJETA"];
const TIPOS: [TipoPedido, string][] = [["MESA", "En mesa"], ["PARA_LLEVAR", "Para llevar"], ["DELIVERY", "Delivery"]];

const parte = (monto: string, total: string) => (Number(total) > 0 ? `${Math.round((Number(monto) / Number(total)) * 100)}%` : undefined);

export const porMetodo = ({ ventas }: Reporte) =>
  METODOS.map((m) => ({ clave: m, nombre: nombreDeMetodo(m), valor: Number(ventas.porMetodo[m]), texto: soles(ventas.porMetodo[m]), detalle: parte(ventas.porMetodo[m], ventas.total) }));

export const porTipo = ({ ventas }: Reporte) =>
  TIPOS.map(([tipo, nombre]) => ({ clave: tipo, nombre, valor: Number(ventas.porTipo[tipo]), texto: soles(ventas.porTipo[tipo]), detalle: parte(ventas.porTipo[tipo], ventas.total) }));

export const platosMasPedidos = ({ platos }: Reporte) =>
  platos.map((p) => ({ clave: p.nombre, nombre: p.nombre, valor: p.cantidad, texto: String(p.cantidad), detalle: soles(p.total) }));

// Un promedio de segundos no es "0 min": se dice "menos de 1 min"
export const minutosEnPalabras = (minutos: number | null): string =>
  minutos === null ? "Sin datos" : minutos < 1 ? "menos de 1 min" : `${Math.round(minutos)} min`;

// Cómo cerró un turno: cuadró, faltó o sobró
export function cierreDe(turno: Turno): { estado: "abierto" | "cuadro" | "falto" | "sobro"; texto: string } {
  if (turno.diferencia === null) return { estado: "abierto", texto: "Sigue abierto" };
  const diferencia = Number(turno.diferencia);
  if (diferencia === 0) return { estado: "cuadro", texto: "Cuadró" };
  return diferencia < 0 ? { estado: "falto", texto: `Faltaron ${soles(-diferencia)}` } : { estado: "sobro", texto: `Sobraron ${soles(diferencia)}` };
}

export function correccionEnPalabras(c: Correccion): string {
  if (c.tipo === "ANULACION") return `Anuló un pago de ${soles(c.monto)} del pedido ${c.pedido.numero}`;
  const { antes, despues } = c.detalle;
  const cambio = antes && despues ? ` de ${nombreDeMetodo(antes.metodo)} a ${nombreDeMetodo(despues.metodo)}` : "";
  return `Cambió${cambio} un pago de ${soles(c.monto)} del pedido ${c.pedido.numero}`;
}
