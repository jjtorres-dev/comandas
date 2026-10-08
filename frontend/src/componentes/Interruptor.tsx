import { useId } from "react";

type Props = {
  etiqueta: string;
  // Explica qué pasa al apagarlo
  ayuda?: string;
  activo: boolean;
  alCambiar: (activo: boolean) => void;
  disabled?: boolean;
};

// Encendido o apagado, con la palabra a la vista (nunca solo el color)
export function Interruptor({ etiqueta, ayuda, activo, alCambiar, disabled = false }: Props) {
  const idAyuda = useId();

  return (
    <button
      type="button"
      role="switch"
      aria-label={etiqueta}
      aria-describedby={ayuda ? idAyuda : undefined}
      aria-checked={activo}
      disabled={disabled}
      onClick={() => alCambiar(!activo)}
      className="presionable flex min-h-14 w-full cursor-pointer items-center gap-4 rounded-control border-2 border-borde-fuerte bg-superficie px-4 py-2 text-left disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-bold text-tinta">{etiqueta}</span>
        {ayuda && <span id={idAyuda} className="block text-base text-texto-suave">{ayuda}</span>}
      </span>
      <span className="shrink-0 text-lg font-bold text-marino">{activo ? "Sí" : "No"}</span>
      <span aria-hidden="true" className={`flex h-8 w-14 shrink-0 items-center rounded-full border-2 px-0.5 transition-colors duration-150 ${activo ? "justify-end border-marino bg-marino" : "justify-start border-borde-fuerte bg-fondo"}`}>
        <span className={`size-6 rounded-full ${activo ? "bg-superficie" : "bg-borde-fuerte"}`} />
      </span>
    </button>
  );
}
