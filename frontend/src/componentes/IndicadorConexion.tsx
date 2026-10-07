import { ArrowsClockwiseIcon, WifiHighIcon } from "@phosphor-icons/react";
import { useConexion } from "../tiempo-real/contexto";

// Siempre a la vista: dice con texto e ícono (no solo con color) si los
// pedidos están llegando en vivo.
export function IndicadorConexion() {
  const enLinea = useConexion() === "en-linea";

  return (
    <p
      role="status"
      aria-live="polite"
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-base font-bold text-tinta transition-colors duration-200 ${
        enLinea ? "bg-listo-suave" : "bg-alerta"
      }`}
    >
      {enLinea ? (
        <WifiHighIcon aria-hidden="true" weight="bold" className="size-5 text-listo-fuerte" />
      ) : (
        <ArrowsClockwiseIcon aria-hidden="true" weight="bold" className="size-5 animate-spin" />
      )}
      {enLinea ? "En línea" : "Reconectando"}
    </p>
  );
}
