import { type ReactNode, useEffect, useState } from "react";

type Props = {
  alConfirmar: () => void;
  // Texto normal y texto de la segunda pulsación ("Cancelar plato" → "Sí, cancelar")
  texto: string;
  pregunta: string;
  icono?: ReactNode;
  ocupado?: boolean;
  className?: string;
};

// Acción destructiva con segunda pulsación: el botón pasa a rojo durante 4
// segundos. Un toque accidental en hora punta no borra nada.
export function BotonConfirmar({ alConfirmar, texto, pregunta, icono, ocupado = false, className = "" }: Props) {
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (!confirmando) return;
    const reloj = setTimeout(() => setConfirmando(false), 4000);
    return () => clearTimeout(reloj);
  }, [confirmando]);

  return (
    <button
      type="button"
      disabled={ocupado}
      onClick={() => {
        if (confirmando) alConfirmar();
        setConfirmando(!confirmando);
      }}
      className={`presionable inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-control border-2 border-peligro px-4 text-lg font-bold disabled:opacity-60 ${
        confirmando ? "bg-peligro text-white" : "bg-superficie text-peligro hover:bg-peligro-suave"
      } ${className}`}
    >
      {icono}
      {/* Los dos textos ocupan la misma celda: el botón no cambia de ancho bajo el dedo */}
      <span aria-live="polite" className="grid items-center text-center whitespace-nowrap">
        <span aria-hidden={confirmando} className={`col-start-1 row-start-1 ${confirmando ? "invisible" : ""}`}>
          {texto}
        </span>
        <span aria-hidden={!confirmando} className={`col-start-1 row-start-1 ${confirmando ? "" : "invisible"}`}>
          {pregunta}
        </span>
      </span>
    </button>
  );
}
