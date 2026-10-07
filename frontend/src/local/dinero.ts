// Cuentas de caja en céntimos enteros: sumar y restar soles con decimales en
// punto flotante da vueltos de S/ 3.9999. El servidor sigue siendo la verdad;
// esto solo arma lo que se le envía y lo que se muestra mientras se escribe.
import type { MetodoPago } from "../lib/tipos";

export const centimos = (monto: string | number): number => Math.round(Number(monto) * 100);

export const soles = (c: number): string => `S/ ${(c / 100).toFixed(2)}`;

// Lo que se escribe en un campo de monto: "50", "50.5", "50,50". null si no es un monto.
export function leerMonto(texto: string): number | null {
  const limpio = texto.trim().replace(",", ".");
  if (!/^\d{1,5}(\.\d{0,2})?$/.test(limpio)) return null;
  return centimos(limpio);
}

// Para enviar a la API: número con 2 decimales como máximo
export const paraApi = (c: number): number => Number((c / 100).toFixed(2));

// Divide un saldo en N partes iguales; los céntimos que sobran van a la última
export function partesIguales(saldo: number, personas: number): number[] {
  const parte = Math.floor(saldo / personas);
  return Array.from({ length: personas }, (_, i) => (i === personas - 1 ? saldo - parte * (personas - 1) : parte));
}

export const METODOS: { id: MetodoPago; nombre: string; tecla: string }[] = [
  { id: "EFECTIVO", nombre: "Efectivo", tecla: "E" },
  { id: "YAPE", nombre: "Yape", tecla: "Y" },
  { id: "PLIN", nombre: "Plin", tecla: "P" },
  { id: "TARJETA", nombre: "Tarjeta", tecla: "T" },
];

export const nombreDeMetodo = (metodo: MetodoPago): string => METODOS.find((m) => m.id === metodo)!.nombre;
