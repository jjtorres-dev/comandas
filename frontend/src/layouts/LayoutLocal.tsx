import { CashRegisterIcon, CookingPotIcon, type Icon, MopedIcon, SignOutIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router";
import { Cabecera } from "../componentes/Cabecera";
import { useSesion } from "../sesion/contexto";

const PESTANAS: { ruta: string; nombre: string; icono: Icon }[] = [
  { ruta: "cocina", nombre: "Cocina", icono: CookingPotIcon },
  { ruta: "caja", nombre: "Caja", icono: CashRegisterIcon },
  { ruta: "delivery", nombre: "Delivery", icono: MopedIcon },
];

// Cocina y caja: una sola persona frente a un monitor, a veces lejos de él.
// Ancho completo, pestañas grandes y texto marino sobre blanco (contraste AAA).
export function LayoutLocal() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecera acciones={<Salir />}>
        <nav aria-label="Secciones">
          <ul className="grid grid-cols-3 gap-1 rounded-control bg-superficie p-1 lg:inline-grid lg:min-w-[34rem]">
            {PESTANAS.map(({ ruta, nombre, icono: Icono }) => (
              <li key={ruta}>
                <NavLink
                  to={ruta}
                  className={({ isActive }) =>
                    `presionable relative flex min-h-12 items-center justify-center gap-2 rounded-[0.625rem] px-3 text-lg font-bold lg:min-h-14 lg:text-2xl ${
                      isActive ? "text-white" : "text-marino hover:bg-primario-suave"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="pestana-activa"
                          className="absolute inset-0 rounded-[0.625rem] bg-marino"
                          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        />
                      )}
                      <Icono aria-hidden="true" weight={isActive ? "fill" : "regular"} className="relative size-6 lg:size-8" />
                      <span className="relative">{nombre}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </Cabecera>

      <main className="flex w-full flex-1 flex-col px-4 py-5 lg:px-8 lg:py-8">
        <Outlet />
      </main>
    </div>
  );
}

// Salir pide una segunda pulsación: un toque accidental en plena hora punta
// no debe dejar la cocina sin pantalla.
function Salir() {
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
