// Las líneas de un pedido que todavía no se envía. Todo son funciones puras:
// reciben la lista y devuelven una nueva.
import type { OpcionCombo, Producto, Variante } from "../lib/tipos";
import { nuevoId } from "./uuid";

export type Linea = {
  id: string;
  productoId: string;
  varianteId: string;
  // "Producto" o "Producto — Variante", como lo mostrará la cocina
  nombre: string;
  // De la carta del servidor; el total definitivo lo calcula el servidor
  precio: number;
  cantidad: number;
  notas: string[];
  // Solo combos: los platos elegidos
  componentes: OpcionCombo[];
  // Solo combos: de qué plato es cada nota, para poder volver a editarlas.
  // `notas` lleva lo mismo ya escrito como lo verá cocina.
  notasCombo?: NotasCombo;
};

export type NotasDePlato = {
  // Notas rápidas marcadas y texto libre
  marcadas: string[];
  libre: string;
  // El combo trae 2 o más de este plato y la nota es solo para uno
  soloUno: boolean;
};

// Clave: productoId del plato, o TODO_EL_COMBO
export type NotasCombo = Record<string, NotasDePlato>;

export const TODO_EL_COMBO = "todo";

const MAXIMO = 99;

export function lineaDe(producto: Producto, variante: Variante, componentes: OpcionCombo[] = []): Linea {
  return {
    id: nuevoId(),
    productoId: producto.id,
    varianteId: variante.id,
    nombre: variante.nombre === "Única" ? producto.nombre : `${producto.nombre} — ${variante.nombre}`,
    precio: Number(variante.precio),
    cantidad: 1,
    notas: [],
    componentes,
  };
}

// Dos líneas son "la misma" si piden lo mismo con las mismas notas
const huella = (l: Linea) =>
  [l.varianteId, [...l.notas].sort().join("\u0001"), l.componentes.map((c) => c.productoId).sort().join(",")].join("|");

// Une las líneas iguales en la primera que aparece
export function unir(lineas: Linea[]): Linea[] {
  const porHuella = new Map<string, Linea>();
  for (const linea of lineas) {
    const clave = huella(linea);
    const previa = porHuella.get(clave);
    porHuella.set(clave, previa ? { ...previa, cantidad: Math.min(MAXIMO, previa.cantidad + linea.cantidad) } : linea);
  }
  return [...porHuella.values()];
}

export const agregar = (lineas: Linea[], nueva: Linea): Linea[] => unir([...lineas, nueva]);

export function cambiarCantidad(lineas: Linea[], id: string, delta: number): Linea[] {
  return lineas
    .map((l) => (l.id === id ? { ...l, cantidad: Math.min(MAXIMO, l.cantidad + delta) } : l))
    .filter((l) => l.cantidad > 0);
}

// El "−" de la carta: quita una unidad del producto, primero de la línea sin
// notas y, si no hay, de la última que se agregó
export function quitarUno(lineas: Linea[], productoId: string): Linea[] {
  const delProducto = lineas.filter((l) => l.productoId === productoId);
  const objetivo = delProducto.findLast((l) => l.notas.length === 0) ?? delProducto.at(-1);
  return objetivo ? cambiarCantidad(lineas, objetivo.id, -1) : lineas;
}

// Platos distintos de un combo, con cuántas veces se eligió cada uno
export function platosDe(componentes: OpcionCombo[]): (OpcionCombo & { veces: number })[] {
  const platos = new Map<string, OpcionCombo & { veces: number }>();
  for (const c of componentes) platos.set(c.productoId, { ...c, veces: (platos.get(c.productoId)?.veces ?? 0) + 1 });
  return [...platos.values()];
}

const enMinuscula = (texto: string) => texto.charAt(0).toLowerCase() + texto.slice(1);

// Los textos de una entrada, con las notas rápidas en el orden de la carta
export const textosDe = (entrada: NotasDePlato | undefined, rapidas: string[]): string[] =>
  entrada ? [...rapidas.filter((t) => entrada.marcadas.includes(t)), ...(entrada.libre.trim() ? [entrada.libre.trim()] : [])] : [];

// Las notas de un combo como las verá cocina: "Ceviche Simple: sin cebolla",
// "Solo 1 Ceviche Simple: sin cebolla", o la nota sola si es para todo el combo
export function notasDeCombo(componentes: OpcionCombo[], notasCombo: NotasCombo, rapidas: string[]): string[] {
  const deTodo = textosDe(notasCombo[TODO_EL_COMBO], rapidas);
  const dePlatos = platosDe(componentes).flatMap((plato) => {
    const entrada = notasCombo[plato.productoId];
    const prefijo = entrada?.soloUno && plato.veces > 1 ? `Solo 1 ${plato.nombre}` : plato.nombre;
    // La API admite hasta 100 caracteres por nota
    return textosDe(entrada, rapidas).map((texto) => `${prefijo}: ${enMinuscula(texto)}`.slice(0, 100));
  });
  return [...deTodo, ...dePlatos].slice(0, 10);
}

// "una": la línea se separa en 1 unidad con las notas nuevas y el resto como estaba
export function ponerNotas(lineas: Linea[], id: string, notas: string[], alcance: "todas" | "una", notasCombo?: NotasCombo): Linea[] {
  return unir(
    lineas.flatMap((l) => {
      if (l.id !== id) return [l];
      if (alcance === "todas" || l.cantidad === 1) return [{ ...l, notas, notasCombo }];
      return [
        { ...l, cantidad: l.cantidad - 1 },
        { ...l, id: nuevoId(), cantidad: 1, notas, notasCombo },
      ];
    }),
  );
}

export const cantidadTotal = (lineas: Linea[]): number => lineas.reduce((suma, l) => suma + l.cantidad, 0);

export const montoTotal = (lineas: Linea[]): number => lineas.reduce((suma, l) => suma + l.cantidad * l.precio, 0);

export const cantidadDe = (lineas: Linea[], productoId: string): number =>
  lineas.reduce((suma, l) => suma + (l.productoId === productoId ? l.cantidad : 0), 0);

// El formato que espera POST /pedidos y POST /pedidos/:id/items
export const comoItems = (lineas: Linea[]) =>
  lineas.map((l) => ({
    varianteId: l.varianteId,
    cantidad: l.cantidad,
    notas: l.notas,
    ...(l.componentes.length > 0 ? { componentes: l.componentes.map((c) => c.productoId) } : {}),
  }));
