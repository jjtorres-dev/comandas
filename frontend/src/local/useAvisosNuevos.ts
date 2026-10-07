import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { consultaCarta, consultaPedidosActivos } from "../lib/consultas";
import { armarPanel, rondasSinEmpezar } from "./comandas";
import { marcarLlegada, sonarNuevo, usePanel } from "./panel";

// Cada cuánto vuelve a sonar mientras haya algo sin empezar
const REPETIR_CADA = 30_000;

// Suena cuando entra un pedido o una ronda nueva, y repite mientras nadie lo
// empiece ni toque su tarjeta. Vive en todo /local: también suena en Caja.
// Devuelve cuántos pedidos están sin empezar (para la pestaña Cocina).
export function useAvisosNuevos(): number {
  const { abierta, areaId, silenciados } = usePanel();
  const { data: pedidos } = useQuery(consultaPedidosActivos);
  const { data: carta } = useQuery(consultaCarta);

  // Lo que hace sonar (rondas sin empezar del área filtrada) y todo lo que hay sin
  // empezar en cualquier área (para saber qué es de verdad nuevo)
  const { sinEmpezar, todas } = useMemo(() => {
    if (!pedidos) return { sinEmpezar: null, todas: null };
    const areas = carta?.areas ?? [];
    // Un filtro guardado de un área que ya no existe equivale a "Todas", igual que en el panel
    const filtro = areas.some((a) => a.id === areaId) ? areaId : null;
    return {
      sinEmpezar: rondasSinEmpezar(armarPanel(pedidos, areas, filtro).comandas),
      todas: rondasSinEmpezar(armarPanel(pedidos, areas, null).comandas),
    };
  }, [pedidos, carta, areaId]);

  // Rondas ya conocidas, acumuladas: lo que estaba al abrir no "llega", cambiar
  // de filtro no inventa pedidos nuevos y deshacer un "Empezar" no vuelve a avisar
  const vistas = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!sinEmpezar || !todas) return;
    const anteriores = vistas.current;
    vistas.current = new Set([...(anteriores ?? []), ...todas.map((r) => r.clave)]);
    if (!anteriores) return;
    const nuevas = sinEmpezar.filter((r) => !anteriores.has(r.clave));
    if (nuevas.length === 0) return;
    for (const { pedidoId } of nuevas) marcarLlegada(pedidoId);
    if (abierta) sonarNuevo();
  }, [sinEmpezar, todas, abierta]);

  const porAtender = (sinEmpezar ?? []).filter((r) => !silenciados.has(r.clave)).length;

  useEffect(() => {
    if (!abierta || porAtender === 0) return;
    const reloj = setInterval(sonarNuevo, REPETIR_CADA);
    return () => clearInterval(reloj);
  }, [abierta, porAtender]);

  return new Set((sinEmpezar ?? []).map((r) => r.pedidoId)).size;
}
