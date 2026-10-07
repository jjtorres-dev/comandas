// Cambios de estado desde la cocina, todos con "Deshacer": con las manos
// mojadas se toca lo que no es.
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { api, mensajeDe } from "../lib/api";
import { claves, clienteDeConsultas, consultaPedidosActivos } from "../lib/consultas";
import type { EstadoItem, ItemPedido, Pedido } from "../lib/tipos";

// Segundos que la barra de Deshacer queda a la vista
export const SEGUNDOS_DESHACER = 8;

export type Deshacer = {
  id: number;
  texto: string;
  pedidoId: string;
  // Estado al que pasaron los platos, y el que tenía cada uno antes
  puesto: EstadoItem;
  previos: Record<string, EstadoItem>;
};

let actual: Deshacer | null = null;
let ocupado = false;
let serie = 0;
let reloj: ReturnType<typeof setTimeout> | undefined;
const oyentes = new Set<() => void>();

function fijar(nuevo: Deshacer | null, enCurso = ocupado) {
  actual = nuevo;
  ocupado = enCurso;
  clearTimeout(reloj);
  if (nuevo) reloj = setTimeout(() => fijar(null), SEGUNDOS_DESHACER * 1000);
  for (const oyente of oyentes) oyente();
}

const suscribir = (oyente: () => void) => {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
};

export const useDeshacer = (): Deshacer | null => useSyncExternalStore(suscribir, () => actual);
// true mientras un cambio viaja al servidor: los botones se bloquean para no duplicar toques
export const useOcupado = (): boolean => useSyncExternalStore(suscribir, () => ocupado);

export const cerrarDeshacer = () => fijar(null);

async function enviar(pedidoId: string, itemIds: string[], estado: EstadoItem) {
  const { pedido } = await api<{ pedido: Pedido }>(`/pedidos/${pedidoId}/items/estado`, {
    metodo: "PATCH",
    cuerpo: { itemIds, estado },
    // Una petición colgada no puede dejar todos los botones bloqueados
    signal: AbortSignal.timeout(10_000),
  });
  // La pantalla muestra lo que confirmó el servidor, sin esperar al evento de tiempo real
  clienteDeConsultas.setQueryData(consultaPedidosActivos.queryKey, (lista) => lista?.map((p) => (p.id === pedido.id ? pedido : p)));
  void clienteDeConsultas.invalidateQueries({ queryKey: claves.pedidos });
  void clienteDeConsultas.invalidateQueries({ queryKey: claves.mesas });
}

// Cambia de estado un conjunto de platos y ofrece deshacerlo
export async function marcar(pedido: Pedido, items: ItemPedido[], estado: EstadoItem, texto: string) {
  if (items.length === 0 || ocupado) return;
  const previos = Object.fromEntries(items.map((i) => [i.id, i.estado]));
  fijar(null, true);
  try {
    await enviar(pedido.id, items.map((i) => i.id), estado);
    fijar({ id: ++serie, texto, pedidoId: pedido.id, puesto: estado, previos }, false);
  } catch (error) {
    fijar(null, false);
    toast.error(mensajeDe(error));
  }
}

// Devuelve cada plato al estado exacto que tenía
export async function deshacer() {
  const cambio = actual;
  if (!cambio || ocupado) return;
  fijar(null, true);

  // Solo se deshace lo que sigue como lo dejó este cambio: si entretanto el
  // mozo entregó un plato, ese ya no se toca
  const vigente = clienteDeConsultas.getQueryData(consultaPedidosActivos.queryKey)?.find((p) => p.id === cambio.pedidoId);
  const pendientes = Object.fromEntries(
    Object.entries(cambio.previos).filter(([itemId]) => vigente?.items.find((i) => i.id === itemId)?.estado === cambio.puesto),
  );

  try {
    // Un cambio por cada estado anterior distinto
    for (const estado of new Set(Object.values(pendientes))) {
      const itemIds = Object.keys(pendientes).filter((id) => pendientes[id] === estado);
      await enviar(cambio.pedidoId, itemIds, estado);
      for (const id of itemIds) delete pendientes[id];
    }
    fijar(null, false);
  } catch (error) {
    toast.error(`No se pudo deshacer del todo. ${mensajeDe(error)}`);
    // Lo que faltó devolver sigue ofreciéndose: se puede reintentar
    fijar(Object.keys(pendientes).length > 0 ? { ...cambio, id: ++serie, previos: pendientes } : null, false);
  }
}
