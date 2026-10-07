import { useEffect, useMemo, useState } from "react";
import type { Pedido } from "../lib/tipos";

// Segundos que un plato cancelado sigue a la vista, tachado
const SEGUNDOS = 6;

// Una tanda de platos cancelados a la vez, con su hora de salida
type Tanda = { itemIds: string[]; pedidos: Pedido[]; hasta: number };

const sinTerminar = (pedido: Pedido) => pedido.items.filter((i) => i.estado === "PENDIENTE" || i.estado === "PREPARANDO");

// Compara dos respuestas del servidor: qué platos por preparar pasaron a cancelados
function cancelaciones(previos: Pedido[], actuales: Pedido[]): Omit<Tanda, "hasta"> | null {
  const porId = new Map(actuales.map((p) => [p.id, p]));
  const itemIds: string[] = [];
  const pedidos: Pedido[] = [];
  for (const previo of previos) {
    const actual = porId.get(previo.id);
    const vivos = sinTerminar(previo);
    if (!actual) {
      // Salió de los activos con platos sin terminar: lo cancelaron entero.
      // Se conserva una copia con esos platos tachados.
      if (vivos.length === 0) continue;
      pedidos.push({ ...previo, estado: "CANCELADO", items: previo.items.map((i) => (vivos.includes(i) ? { ...i, estado: "CANCELADO" } : i)) });
      itemIds.push(...vivos.map((i) => i.id));
      continue;
    }
    for (const item of vivos) {
      if (actual.items.find((i) => i.id === item.id)?.estado === "CANCELADO") itemIds.push(item.id);
    }
  }
  return itemIds.length > 0 ? { itemIds, pedidos } : null;
}

// Un plato que se cancela no desaparece de golpe de la comanda (la cocina
// podría no darse cuenta): se queda unos segundos tachado. Devuelve los
// pedidos a mostrar (incluye los que se cancelaron enteros y ya no están
// activos) y los ids de los platos recién cancelados.
export function useCancelados(pedidos: Pedido[] | undefined): { pedidos: Pedido[] | undefined; tachados: ReadonlySet<string> } {
  const [tandas, setTandas] = useState<Tanda[]>([]);

  // Cada respuesta nueva se compara con la anterior
  const [previos, setPrevios] = useState(pedidos);
  if (pedidos !== previos) {
    setPrevios(pedidos);
    const nueva = pedidos && previos ? cancelaciones(previos, pedidos) : null;
    if (nueva) setTandas((t) => [...t, { ...nueva, hasta: Date.now() + SEGUNDOS * 1000 }]);
  }

  // La tanda más antigua se retira cuando vence
  useEffect(() => {
    if (tandas.length === 0) return;
    const reloj = setTimeout(() => setTandas((t) => t.slice(1)), Math.max(0, tandas[0].hasta - Date.now()));
    return () => clearTimeout(reloj);
  }, [tandas]);

  return useMemo(() => {
    const tachados = new Set(tandas.flatMap((t) => t.itemIds));
    const activos = new Set(pedidos?.map((p) => p.id));
    const despedidos = tandas.flatMap((t) => t.pedidos).filter((p) => !activos.has(p.id));
    return { pedidos: pedidos && despedidos.length > 0 ? [...pedidos, ...despedidos] : pedidos, tachados };
  }, [pedidos, tandas]);
}
