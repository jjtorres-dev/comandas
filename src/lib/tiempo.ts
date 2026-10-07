const ZONA_NEGOCIO = "America/Lima";

// Instante (UTC) en que empezó el día actual en la zona horaria del negocio.
// Se usa para el correlativo diario de pedidos.
export function inicioDelDia(ahora: Date = new Date(), zona: string = ZONA_NEGOCIO): Date {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(ahora);
  const n = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value);

  // Hora de pared en la zona, expresada como si fuera UTC
  const paredComoUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  const desfase = paredComoUtc - Math.floor(ahora.getTime() / 1000) * 1000;

  return new Date(Date.UTC(n("year"), n("month") - 1, n("day")) - desfase);
}

// Fecha y hora en la zona del negocio: "07/10/2026, 10:15"
export function fechaHoraLocal(fecha: Date, zona: string = ZONA_NEGOCIO): string {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: zona,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(fecha);
}
