import { useEffect, useState } from "react";

// Soles con 2 decimales, siempre: "S/ 25.00"
export const soles = (monto: number | string): string => `S/ ${Number(monto).toFixed(2)}`;

export const plural = (cantidad: number, uno: string, varios: string): string =>
  `${cantidad} ${cantidad === 1 ? uno : varios}`;

// Tiempo transcurrido en palabras cortas: "recién", "hace 25 min", "hace 1 h 10 min"
export function haceCuanto(fecha: string, ahora: number): string {
  const minutos = Math.max(0, Math.floor((ahora - new Date(fecha).getTime()) / 60_000));
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const resto = minutos % 60;
  return `hace ${Math.floor(minutos / 60)} h${resto ? ` ${resto} min` : ""}`;
}

const formatoHora = new Intl.DateTimeFormat("es-PE", { hour: "numeric", minute: "2-digit", hour12: false });

export const horaDe = (fecha: string): string => formatoHora.format(new Date(fecha));

// Reloj que avanza solo, para los "hace X min"
export function useAhora(cadaMs = 30_000): number {
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const reloj = setInterval(() => setAhora(Date.now()), cadaMs);
    return () => clearInterval(reloj);
  }, [cadaMs]);
  return ahora;
}

// Platos de un combo, sin repetir: "2 Ceviche Simple + Arroz con Mariscos"
export function platosDeCombo(nombres: string[]): string {
  const veces = new Map<string, number>();
  for (const nombre of nombres) veces.set(nombre, (veces.get(nombre) ?? 0) + 1);
  return [...veces].map(([nombre, n]) => (n > 1 ? `${n} ${nombre}` : nombre)).join(" + ");
}
