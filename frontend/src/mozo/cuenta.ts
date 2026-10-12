// La cuenta de la mesa: los items de todas las rondas sumados por producto.
// Funciones puras sobre el pedido que confirmó el servidor.
import type { Carta, EstadoItem, ItemPedido } from "../lib/tipos";
import type { Linea } from "./lineas";
import { nuevoId } from "./uuid";

// Lo mismo pedido igual: variante, notas y platos del combo (el orden no importa)
const pedidoIgual = (varianteId: string, notas: string[], componentes: string[]) =>
  [varianteId, [...notas].sort().join("\u0001"), [...componentes].sort().join("\u0001")].join("|");

export const huellaDeItem = (item: ItemPedido): string => pedidoIgual(item.varianteId, item.notas, item.componentes);
export const huellaDeLinea = (linea: Linea): string => pedidoIgual(linea.varianteId, linea.notas, linea.componentes.map((c) => c.nombre));

export type LineaDeCuenta = {
  clave: string;
  // Lo que identifica "lo mismo" también en lo que todavía no se envía
  huella: string;
  nombre: string;
  notas: string[];
  componentes: string[];
  cantidad: number;
  centimos: number;
  pasaPorCocina: boolean;
  // Los items del servidor que suma esta línea, en el orden en que se pidieron
  items: ItemPedido[];
};

const enCentimos = (monto: string) => Math.round(Number(monto) * 100);

// Sin los cancelados. Dos items se suman si piden lo mismo al mismo precio
export function acumular(items: ItemPedido[]): LineaDeCuenta[] {
  const lineas = new Map<string, LineaDeCuenta>();
  for (const item of items) {
    if (item.estado === "CANCELADO") continue;
    const huella = huellaDeItem(item);
    const clave = `${huella}|${item.precioUnitario}`;
    const previa = lineas.get(clave);
    const centimos = enCentimos(item.precioUnitario) * item.cantidad;
    if (previa) {
      previa.cantidad += item.cantidad;
      previa.centimos += centimos;
      previa.items.push(item);
    } else {
      lineas.set(clave, {
        clave,
        huella,
        nombre: item.nombreProducto,
        notas: item.notas,
        componentes: item.componentes,
        cantidad: item.cantidad,
        centimos,
        pasaPorCocina: item.pasaPorCocina,
        items: [item],
      });
    }
  }
  return [...lineas.values()];
}

// En el orden en que le importa al mozo: lo que ya puede llevar, primero
const ORDEN: EstadoItem[] = ["LISTO", "PREPARANDO", "PENDIENTE", "ENTREGADO"];

// Cómo va la cocina con esta línea: [{ LISTO, 1 }, { PREPARANDO, 1 }]. Lo que
// no pasa por cocina no tiene estado que contar.
export function estadoDeCocina(linea: LineaDeCuenta): { estado: EstadoItem; cantidad: number }[] {
  if (!linea.pasaPorCocina) return [];
  return ORDEN.map((estado) => ({
    estado,
    cantidad: linea.items.reduce((suma, i) => suma + (i.estado === estado ? i.cantidad : 0), 0),
  })).filter((e) => e.cantidad > 0);
}

// El "−" de la cuenta: de qué item sale la unidad. Primero lo que cocina
// todavía no empezó (lo último que se pidió); lo que no pasa por cocina se
// quita aunque ya esté en la mesa. null: la cocina ya lo está preparando.
export function paraQuitar(linea: LineaDeCuenta): ItemPedido | null {
  const delUltimo = [...linea.items].reverse();
  return delUltimo.find((i) => i.pasaPorCocina && i.estado === "PENDIENTE") ?? delUltimo.find((i) => !i.pasaPorCocina) ?? null;
}

// El "+" de la cuenta: una unidad más de lo mismo, como línea de una ronda
// nueva. Sale de la carta de hoy (precio y platos del combo); null si ese
// plato ya no se ofrece.
export function unaMas(linea: LineaDeCuenta, carta: Carta): Linea | null {
  const { varianteId } = linea.items[0];
  const producto = carta.categorias.flatMap((c) => c.productos).find((p) => p.variantes.some((v) => v.id === varianteId));
  const variante = producto?.variantes.find((v) => v.id === varianteId);
  if (!producto || !variante) return null;

  const componentes = linea.componentes.map((nombre) => producto.opcionesCombo.find((o) => o.nombre === nombre));
  if (componentes.some((c) => !c)) return null;

  return {
    id: nuevoId(),
    productoId: producto.id,
    varianteId,
    nombre: linea.nombre,
    precio: Number(variante.precio),
    cantidad: 1,
    notas: linea.notas,
    componentes: componentes.map((c) => c!),
  };
}
