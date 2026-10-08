// El pago previsto de un pedido por teléfono mientras se elige en pantalla
import type { MetodoPago, MomentoPago, PagoPrevisto as Previsto } from "../lib/tipos";
import { leerMonto, paraApi, soles } from "./dinero";

// Lo que se está eligiendo en pantalla. `pagaCon` es texto mientras se escribe.
export type PagoElegido = { momento: MomentoPago | null; metodo: MetodoPago | null; pagaCon: string };

export const PAGO_VACIO: PagoElegido = { momento: null, metodo: null, pagaCon: "" };

export const pagoDesde = (previsto: Previsto | null): PagoElegido =>
  previsto ? { momento: previsto.momento, metodo: previsto.metodo, pagaCon: previsto.pagaCon ? String(Number(previsto.pagaCon)) : "" } : PAGO_VACIO;

// Qué falta para que el pago previsto esté completo, o null si ya lo está
export function faltaEnPago(pago: PagoElegido, total: number): string | null {
  if (!pago.momento) return "Elige cómo va a pagar";
  if (!pago.metodo) return pago.momento === "ANTICIPADO" ? "Elige si pagó por Yape o Plin" : "Elige con qué paga al recibir";
  if (pago.momento === "AL_RECIBIR" && pago.metodo === "EFECTIVO" && pago.pagaCon.trim()) {
    const pagaCon = leerMonto(pago.pagaCon);
    if (pagaCon === null) return "Revisa con cuánto paga";
    if (pagaCon < total) return `Con ${soles(pagaCon)} no alcanza para ${soles(total)}`;
  }
  return null;
}

// Como lo espera la API
export function pagoParaApi(pago: PagoElegido) {
  const pagaCon = pago.momento === "AL_RECIBIR" && pago.metodo === "EFECTIVO" && pago.pagaCon.trim() ? leerMonto(pago.pagaCon) : null;
  return { momento: pago.momento!, metodo: pago.metodo!, ...(pagaCon !== null ? { pagaCon: paraApi(pagaCon) } : {}) };
}
