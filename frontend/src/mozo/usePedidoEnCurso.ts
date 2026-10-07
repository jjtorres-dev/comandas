import { useQuery } from "@tanstack/react-query";
import { consultaMesas, consultaPedidosActivos } from "../lib/consultas";
import { type Borrador, type Destino, esParaLlevar, PARA_LLEVAR, useMozo } from "./almacen";

export type PedidoEnCurso = {
  clave: string;
  // null mientras cargan los datos o si la mesa o el pedido ya no existen
  destino: Destino | null;
  // Con pedidoId lo que se anota es una ronda de ese pedido
  pedidoId: string | null;
  borrador: Borrador | undefined;
  cargando: boolean;
  // A dónde vuelve la flecha: al pedido si es una ronda, a Mesas si es nuevo
  volverA: string;
};

// Resuelve a qué corresponde la clave de /mozo/tomar/:clave con los datos
// vivos del servidor: si otro mozo abrió la mesa mientras se anotaba, lo
// anotado pasa a ser una ronda sin que nadie haga nada.
export function usePedidoEnCurso(clave: string): PedidoEnCurso {
  const mesas = useQuery(consultaMesas);
  const pedidos = useQuery(consultaPedidosActivos);
  const borrador = useMozo().borradores[clave];

  let destino: Destino | null = null;
  let pedidoId: string | null = null;
  let cargando = false;

  if (esParaLlevar(clave)) {
    destino = PARA_LLEVAR;
  } else if (clave.startsWith("mesa-")) {
    const mesa = mesas.data?.find((m) => m.id === clave.slice(5));
    cargando = mesas.isPending;
    if (mesa) {
      destino = { tipo: "MESA", mesaId: mesa.id, nombre: mesa.nombre };
      pedidoId = mesa.pedido?.id ?? null;
    }
  } else if (clave.startsWith("pedido-")) {
    const pedido = pedidos.data?.find((p) => p.id === clave.slice(7));
    cargando = pedidos.isPending;
    if (pedido && !pedido.pagado) {
      destino = pedido.mesa
        ? { tipo: "MESA", mesaId: pedido.mesa.id, nombre: pedido.mesa.nombre }
        : { tipo: "PARA_LLEVAR", nombre: `Para llevar #${pedido.numero}` };
      pedidoId = pedido.id;
    }
  }

  // Sin datos del servidor (sin red), el borrador recuerda de quién era
  destino ??= borrador?.destino ?? null;

  return { clave, destino, pedidoId, borrador, cargando, volverA: pedidoId ? `/mozo/pedido/${pedidoId}` : "/mozo/mesas" };
}
