import { WarningCircleIcon } from "@phosphor-icons/react";
import { type InputHTMLAttributes, type ReactNode, useId } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string;
  ayuda?: string;
  error?: string | null;
  // Control al final del campo (p. ej. mostrar u ocultar la contraseña)
  accion?: ReactNode;
};

export function Campo({ etiqueta, ayuda, error, accion, className = "", ...resto }: Props) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-lg font-bold text-marino">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={id}
          {...resto}
          aria-invalid={error ? true : undefined}
          aria-describedby={[error ? idError : null, ayuda ? idAyuda : null].filter(Boolean).join(" ") || undefined}
          className={`h-14 w-full rounded-control border-2 bg-superficie px-4 text-xl text-tinta transition-colors duration-150 placeholder:text-texto-suave focus:border-marino ${
            error ? "border-peligro" : "border-borde-fuerte"
          } ${accion ? "pr-14" : ""} ${className}`}
        />
        {accion && <div className="absolute inset-y-0 right-1 flex items-center">{accion}</div>}
      </div>
      {error && (
        <p id={idError} role="alert" className="flex items-start gap-2 text-base font-bold text-peligro">
          <WarningCircleIcon aria-hidden="true" weight="fill" className="mt-0.5 size-5 shrink-0" />
          {error}
        </p>
      )}
      {ayuda && (
        <p id={idAyuda} className="text-base text-texto-suave">
          {ayuda}
        </p>
      )}
    </div>
  );
}
