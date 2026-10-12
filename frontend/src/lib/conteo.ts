// Cómo se cuenta lo pedido, en todas las pantallas: lo que pasa por cocina son
// "platos" y lo que saca el mozo (áreas que no pasan por cocina) son "bebidas".
// "2 platos", "6 bebidas" o "2 platos · 6 bebidas".
import type { Carta, ItemPedido } from "./tipos";
import { plural } from "./formato";

export type Contable = {
  cantidad: number;
  // false: bebida. Si no se sabe de qué área es, cuenta como plato
  pasaPorCocina?: boolean | null;
  // Lo cancelado no cuenta
  cancelado?: boolean;
};

// Un combo es un solo item: cuenta como 1 plato, no por los platos que trae
export function contar(unidades: Contable[]): { platos: number; bebidas: number } {
  let platos = 0;
  let bebidas = 0;
  for (const u of unidades) {
    if (u.cancelado) continue;
    if (u.pasaPorCocina === false) bebidas += u.cantidad;
    else platos += u.cantidad;
  }
  return { platos, bebidas };
}

// La regla única. Sin nada que contar dice "0 platos"
export function conteo(unidades: Contable[]): string {
  const { platos, bebidas } = contar(unidades);
  const partes = [
    ...(platos > 0 || bebidas === 0 ? [plural(platos, "plato", "platos")] : []),
    ...(bebidas > 0 ? [plural(bebidas, "bebida", "bebidas")] : []),
  ];
  return partes.join(" · ");
}

// Los items de un pedido del servidor: cada uno ya sabe si pasó por cocina
export const contablesDeItems = (items: Pick<ItemPedido, "cantidad" | "pasaPorCocina" | "estado">[]): Contable[] =>
  items.map((i) => ({ cantidad: i.cantidad, pasaPorCocina: i.pasaPorCocina, cancelado: i.estado === "CANCELADO" }));

export const conteoDeItems = (items: Pick<ItemPedido, "cantidad" | "pasaPorCocina" | "estado">[]): string => conteo(contablesDeItems(items));

// Lo que todavía no se envía (líneas del mozo o de Delivery) o los productos
// de la carta: el área sale de la carta, por el producto
export function conteoDeProductos(
  unidades: { productoId: string; cantidad: number }[],
  carta: { areas: Carta["areas"]; categorias: { productos: { id: string; areaId: string }[] }[] } | undefined,
): string {
  const areaDe = new Map(carta?.categorias.flatMap((c) => c.productos.map((p) => [p.id, p.areaId] as const)));
  const pasa = new Map(carta?.areas.map((a) => [a.id, a.pasaPorCocina] as const));
  return conteo(unidades.map((u) => ({ cantidad: u.cantidad, pasaPorCocina: pasa.get(areaDe.get(u.productoId) ?? "") })));
}
