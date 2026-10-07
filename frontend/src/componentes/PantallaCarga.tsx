import { CircleNotchIcon, WifiSlashIcon } from "@phosphor-icons/react";
import { useSesion } from "../sesion/contexto";
import { Boton } from "./Boton";

// Lo que se ve mientras se comprueba la sesión guardada, o si el servidor no
// responde al comprobarla
export function PantallaCarga() {
  const { estado, reintentar, cerrarSesion } = useSesion();

  if (estado === "sin-servidor") {
    return (
      <div className="grid min-h-dvh place-items-center bg-fondo px-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-5 text-center">
          <WifiSlashIcon aria-hidden="true" weight="duotone" className="size-16 text-acento-fuerte" />
          <h1 className="text-2xl font-bold text-balance text-tinta">No se pudo conectar con el servidor</h1>
          <p className="text-lg text-marino">Revisa el wifi o los datos del equipo y vuelve a intentarlo.</p>
          <Boton onClick={reintentar}>Reintentar</Boton>
          <Boton variante="texto" onClick={cerrarSesion}>
            Cerrar sesión
          </Boton>
        </div>
      </div>
    );
  }

  return (
    <div role="status" className="grid min-h-dvh place-items-center bg-fondo">
      <p className="flex items-center gap-3 text-xl font-bold text-marino">
        <CircleNotchIcon aria-hidden="true" weight="bold" className="size-8 animate-spin text-primario-fuerte" />
        Cargando
      </p>
    </div>
  );
}
