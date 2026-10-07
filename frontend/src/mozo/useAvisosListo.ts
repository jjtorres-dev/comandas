import { useQuery } from "@tanstack/react-query";
import { BellRingingIcon } from "@phosphor-icons/react";
import { createElement, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { consultaPedidosActivos } from "../lib/consultas";
import { plural } from "../lib/formato";
import type { Pedido } from "../lib/tipos";
import { avisarListo, prepararSonido } from "./avisos";

export const nombreDePedido = (pedido: Pedido): string =>
  (pedido.mesa ? `${pedido.mesa.nombre}${pedido.mesaLiberada ? " · cuenta reabierta" : ""}` : null) ?? (pedido.tipo === "PARA_LLEVAR" ? `Para llevar #${pedido.numero}` : `Delivery #${pedido.numero}`);

export const listosDe = (pedido: Pedido) => pedido.items.filter((i) => i.estado === "LISTO");

// Vibra, suena y avisa cuando platos de MIS pedidos pasan a LISTO. Compara
// cada respuesta con la anterior: no avisa por lo que ya estaba listo al
// abrir la app, y avisa una sola vez por plato.
export function useAvisosListo(usuarioId: string) {
  const navegar = useNavigate();
  const { data: pedidos } = useQuery(consultaPedidosActivos);
  const vistos = useRef<Map<string, Set<string>> | null>(null);

  useEffect(() => prepararSonido(), []);

  useEffect(() => {
    if (!pedidos) return;
    const anterior = vistos.current;
    const actual = new Map<string, Set<string>>();

    for (const pedido of pedidos) {
      const listos = new Set(listosDe(pedido).map((i) => i.id));
      actual.set(pedido.id, listos);
      if (!anterior || pedido.mozo.id !== usuarioId) continue;

      const previos = anterior.get(pedido.id);
      const nuevos = [...listos].filter((id) => !previos?.has(id));
      if (nuevos.length === 0) continue;

      avisarListo();
      const que = pedido.estado === "LISTO" ? "pedido listo" : plural(listosDe(pedido).reduce((suma, i) => suma + i.cantidad, 0), "plato listo", "platos listos");
      toast.success(`${nombreDePedido(pedido)}: ${que}`, {
        id: `listo-${pedido.id}`,
        duration: 12_000,
        // Lima y campana, como todo lo "listo": no se confunde con un aviso de rutina
        icon: createElement(BellRingingIcon, { weight: "fill", className: "size-6", "aria-hidden": true }),
        classNames: { toast: "!border-[3px] !border-tinta !bg-listo" },
        action: { label: "Ver", onClick: () => void navegar(`/mozo/pedido/${pedido.id}`) },
      });
    }
    vistos.current = actual;
  }, [pedidos, usuarioId, navegar]);
}
