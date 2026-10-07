import { CircleNotchIcon } from "@phosphor-icons/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: "primario" | "secundario" | "peligro" | "texto";
  // Muestra un indicador y bloquea el botón mientras dura la acción
  ocupado?: boolean;
  icono?: ReactNode;
};

const BASE =
  "presionable inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-control px-6 text-xl font-bold disabled:cursor-not-allowed";

const VARIANTES = {
  primario: "bg-primario text-tinta hover:bg-primario-presionado disabled:opacity-60",
  secundario: "border-2 border-marino bg-superficie text-marino hover:bg-primario-suave disabled:opacity-60",
  peligro: "border-2 border-peligro bg-superficie text-peligro hover:bg-peligro-suave disabled:opacity-60",
  texto: "min-h-12 text-lg text-marino underline decoration-2 underline-offset-4 hover:bg-primario-suave disabled:opacity-60",
};

export function Boton({ variante = "primario", ocupado = false, icono, children, disabled, className = "", ...resto }: Props) {
  return (
    <button
      type="button"
      {...resto}
      disabled={disabled || ocupado}
      aria-busy={ocupado || undefined}
      className={`${BASE} ${VARIANTES[variante]} ${className}`}
    >
      {ocupado ? <CircleNotchIcon aria-hidden="true" weight="bold" className="size-6 animate-spin" /> : icono}
      {children}
    </button>
  );
}
