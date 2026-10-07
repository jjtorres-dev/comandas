import { type Icon, PicnicTableIcon, ReceiptIcon, UserCircleIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { NavLink, Outlet } from "react-router";
import { Cabecera } from "../componentes/Cabecera";

const SECCIONES: { ruta: string; nombre: string; icono: Icon }[] = [
  { ruta: "mesas", nombre: "Mesas", icono: PicnicTableIcon },
  { ruta: "pedidos", nombre: "Pedidos", icono: ReceiptIcon },
  { ruta: "perfil", nombre: "Perfil", icono: UserCircleIcon },
];

// Celular Android, de pie y con una mano: la navegación va abajo, al alcance
// del pulgar, y cada destino mide bastante más que los 48 px mínimos.
export function LayoutMozo() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecera />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+6.5rem)]">
        <Outlet />
      </main>

      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-borde bg-superficie pb-[env(safe-area-inset-bottom)] shadow-barra"
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-3 gap-1 px-2 py-1.5">
          {SECCIONES.map(({ ruta, nombre, icono: Icono }) => (
            <li key={ruta}>
              <NavLink
                to={ruta}
                className={({ isActive }) =>
                  `presionable relative flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-control text-base font-bold ${
                    isActive ? "text-tinta" : "text-texto-suave hover:bg-fondo"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="seccion-activa"
                        className="absolute inset-0 rounded-control bg-primario-suave"
                        transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                      />
                    )}
                    <Icono aria-hidden="true" weight={isActive ? "fill" : "regular"} className="relative size-7" />
                    <span className="relative">{nombre}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
