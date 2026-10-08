import { ChartBarIcon, CookingPotIcon, type Icon, ListBulletsIcon, StorefrontIcon, UsersThreeIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { Link, NavLink, Outlet } from "react-router";
import { Cabecera } from "../componentes/Cabecera";
import { Salir } from "../componentes/Salir";
import { useEspacioAvisos } from "../lib/useEspacioAvisos";

const SECCIONES: { ruta: string; nombre: string; icono: Icon }[] = [
  { ruta: "ventas", nombre: "Ventas", icono: ChartBarIcon },
  { ruta: "carta", nombre: "Carta", icono: ListBulletsIcon },
  { ruta: "personal", nombre: "Personal", icono: UsersThreeIcon },
  { ruta: "local", nombre: "Local", icono: StorefrontIcon },
];

// La administración del dueño: desde su celular entre plato y plato (secciones
// abajo, al alcance del pulgar) o con calma en la PC (pestañas arriba).
export function LayoutAdmin() {
  const barraAvisos = useEspacioAvisos();

  return (
    <div className="flex min-h-dvh flex-col">
      <Cabecera
        acciones={
          <>
            <Link
              to="/local"
              aria-label="Cocina y caja"
              className="presionable inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-control bg-superficie px-3 text-lg font-bold text-marino hover:bg-primario-suave"
            >
              <CookingPotIcon aria-hidden="true" weight="bold" className="size-6" />
              <span className="hidden xl:inline">Cocina y caja</span>
            </Link>
            {/* En el celular no cabe junto al nombre del negocio: está al final de Local */}
            <div className="hidden lg:block">
              <Salir />
            </div>
          </>
        }
      >
        <nav aria-label="Secciones" className="hidden lg:block">
          <ul className="inline-grid min-w-[29rem] grid-cols-4 xl:min-w-[40rem] gap-1 rounded-control bg-superficie p-1">
            {SECCIONES.map(({ ruta, nombre, icono: Icono }) => (
              <li key={ruta}>
                <NavLink
                  to={ruta}
                  className={({ isActive }) =>
                    `presionable relative flex min-h-14 items-center justify-center gap-2 rounded-interior px-2 text-lg font-bold xl:px-3 xl:text-xl ${
                      isActive ? "text-white" : "text-marino hover:bg-primario-suave"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="pestana-admin"
                          className="absolute inset-0 rounded-interior bg-marino"
                          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        />
                      )}
                      <Icono aria-hidden="true" weight={isActive ? "fill" : "regular"} className="relative size-6 xl:size-7" />
                      <span className="relative">{nombre}</span>
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </Cabecera>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-5 pb-[calc(env(safe-area-inset-bottom)+6.5rem)] lg:px-8 lg:pb-10">
        <Outlet />
      </main>

      <nav
        ref={barraAvisos}
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-borde bg-superficie pb-[env(safe-area-inset-bottom)] shadow-barra lg:hidden"
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-4 gap-1 px-2 py-1.5">
          {SECCIONES.map(({ ruta, nombre, icono: Icono }) => (
            <li key={ruta}>
              <NavLink
                to={ruta}
                className={({ isActive }) =>
                  `presionable flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-control text-base font-bold ${
                    isActive ? "bg-primario-suave text-tinta" : "text-texto-suave hover:bg-fondo"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icono aria-hidden="true" weight={isActive ? "fill" : "regular"} className="size-7" />
                    {nombre}
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
