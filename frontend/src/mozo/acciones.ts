import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, mensajeDe } from "../lib/api";
import { claves, consultaPedidosActivos } from "../lib/consultas";
import type { Pedido } from "../lib/tipos";
import { listosDe, nombreDePedido } from "./useAvisosListo";
import { plural } from "../lib/formato";

// Tras cada cambio, el pedido que devuelve el servidor reemplaza al de la
// lista sin esperar al evento de tiempo real
function useAlConfirmar() {
  const consultas = useQueryClient();
  return ({ pedido }: { pedido: Pedido }) => {
    consultas.setQueryData(consultaPedidosActivos.queryKey, (lista) => lista?.map((p) => (p.id === pedido.id ? pedido : p)));
    void consultas.invalidateQueries({ queryKey: claves.pedidos });
    void consultas.invalidateQueries({ queryKey: claves.mesas });
  };
}

const cambiarEstado = (pedidoId: string, itemIds: string[], estado: "LISTO" | "ENTREGADO") =>
  api<{ pedido: Pedido }>(`/pedidos/${pedidoId}/items/estado`, { metodo: "PATCH", cuerpo: { itemIds, estado } });

// "Entregado": marca como entregados los platos que están listos. Un toque de
// más no borra el recordatorio de que hay comida esperando: se puede deshacer.
export function useEntregarListos() {
  const alConfirmar = useAlConfirmar();
  return useMutation({
    mutationFn: async (pedido: Pedido) => {
      const itemIds = listosDe(pedido).map((i) => i.id);
      return { ...(await cambiarEstado(pedido.id, itemIds, "ENTREGADO")), itemIds };
    },
    onSuccess: (respuesta) => {
      alConfirmar(respuesta);
      const { pedido, itemIds } = respuesta;
      toast.dismiss(`listo-${pedido.id}`);
      toast(`${nombreDePedido(pedido)}: ${plural(itemIds.length, "entrega marcada", "entregas marcadas")}`, {
        id: `entregado-${pedido.id}`,
        duration: 8000,
        action: {
          label: "Deshacer",
          onClick: () =>
            void cambiarEstado(pedido.id, itemIds, "LISTO").then(alConfirmar, (error: unknown) => toast.error(mensajeDe(error))),
        },
      });
    },
    onError: (error) => toast.error(mensajeDe(error)),
  });
}

export function useCancelarItem(pedidoId: string) {
  const alConfirmar = useAlConfirmar();
  return useMutation({
    mutationFn: (itemId: string) => api<{ pedido: Pedido }>(`/pedidos/${pedidoId}/items/${itemId}/cancelar`, { metodo: "PATCH" }),
    onSuccess: alConfirmar,
    onError: (error) => toast.error(mensajeDe(error)),
  });
}
