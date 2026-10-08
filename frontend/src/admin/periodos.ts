// Los periodos de la pestaña Ventas. Los días son los del negocio (hora de
// Lima), no los del equipo desde el que se mira.

export type Periodo = "hoy" | "semana" | "mes" | "rango";

export const PERIODOS: { id: Periodo; nombre: string }[] = [
  { id: "hoy", nombre: "Hoy" },
  { id: "semana", nombre: "Semana" },
  { id: "mes", nombre: "Mes" },
  { id: "rango", nombre: "Otras fechas" },
];

const UN_DIA = 86_400_000;
const enLima = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" });

// "2026-10-07"
export const hoyEnLima = (ahora: number): string => enLima.format(new Date(ahora));

export const sumarDias = (fecha: string, dias: number): string => new Date(Date.parse(fecha) + dias * UN_DIA).toISOString().slice(0, 10);

export const diasEntre = (desde: string, hasta: string): number => Math.round((Date.parse(hasta) - Date.parse(desde)) / UN_DIA) + 1;

// La semana va de lunes a hoy; el mes, del 1 a hoy
export function rangoDe(periodo: Exclude<Periodo, "rango">, hoy: string): { desde: string; hasta: string } {
  if (periodo === "hoy") return { desde: hoy, hasta: hoy };
  if (periodo === "mes") return { desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
  const diaDeSemana = new Date(`${hoy}T00:00:00Z`).getUTCDay(); // 0 = domingo
  return { desde: sumarDias(hoy, -((diaDeSemana + 6) % 7)), hasta: hoy };
}

const dia = (fecha: string) => new Date(`${fecha}T00:00:00Z`);
const formato = (opciones: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("es-PE", { timeZone: "UTC", ...opciones });
const largo = formato({ weekday: "long", day: "numeric", month: "long" });
const corto = formato({ weekday: "short", day: "numeric" });
const conMes = formato({ day: "numeric", month: "short" });
const mes = formato({ month: "long", year: "numeric" });
const mesCorto = formato({ month: "short" });

// "miércoles, 7 de octubre"
export const fechaLarga = (fecha: string): string => largo.format(dia(fecha));
// "mié 7"
export const fechaCorta = (fecha: string): string => corto.format(dia(fecha)).replace(",", "");
// "7 oct"
export const fechaConMes = (fecha: string): string => conMes.format(dia(fecha)).replace(".", "");
// "octubre de 2026" y "oct"
export const nombreDeMes = (fecha: string): string => mes.format(dia(fecha));
export const mesAbreviado = (fecha: string): string => mesCorto.format(dia(fecha)).replace(".", "");

// El periodo en palabras, para el título: "hoy", "del 5 al 7 de octubre"…
export function periodoEnPalabras(desde: string, hasta: string, hoy: string): string {
  if (desde === hasta) return desde === hoy ? "hoy" : `el ${fechaLarga(desde)}`;
  return `del ${fechaConMes(desde)} al ${fechaConMes(hasta)}`;
}
