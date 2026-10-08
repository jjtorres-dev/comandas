import { SignOutIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useSesion } from "../sesion/contexto";

// Salir pide una segunda pulsación: un toque accidental en plena hora punta
// no debe dejar la cocina sin pantalla.
export function Salir() {
  const { usuario, cerrarSesion } = useSesion();
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (!confirmando) return;
    const reloj = setTimeout(() => setConfirmando(false), 4000);
    return () => clearTimeout(reloj);
  }, [confirmando]);

  return (
    <div className="flex items-center gap-3">
      <p className="hidden max-w-48 truncate text-xl font-bold xl:block">{usuario?.nombre}</p>
      <button
        type="button"
        onClick={() => (confirmando ? cerrarSesion() : setConfirmando(true))}
        aria-label={confirmando ? "Confirmar: cerrar sesión" : "Cerrar sesión"}
        className={`presionable inline-flex h-12 min-w-12 cursor-pointer items-center justify-center gap-2 rounded-control px-3 text-lg font-bold ${
          confirmando ? "bg-peligro text-white" : "bg-superficie text-marino hover:bg-primario-suave"
        }`}
      >
        <SignOutIcon aria-hidden="true" weight="bold" className="size-6" />
        <span className={confirmando ? "" : "hidden sm:inline"}>{confirmando ? "¿Salir?" : "Salir"}</span>
      </button>
    </div>
  );
}
