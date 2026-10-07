import { type Icon, PicnicTableIcon, ReceiptIcon, UserCircleIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet } from "react-router";
import { Cabecera } from "../componentes/Cabecera";
import { consultaPedidosActivos } from "../lib/consultas";
import { useCambio } from "../lib/useCambio";
import { FranjaCola } from "../mozo/FranjaCola";
import { useSesion } from "../sesion/contexto";

const SECCIONES: { ruta: string; nombre: string; icono: Icon }[] = [
  { ruta: "mesas", nombre: "Mesas", icono: PicnicTableIcon },
  { ruta: "pedidos", nombre: "Pedidos", icono: ReceiptIcon },
  { ruta: "perfil", nombre: "Perfil", icono: UserCircleIcon },
];

// Celular Android, de pie y con una mano: la navegación va abajo, al alcance
// del pulgar, y cada destino mide bastante más que los 48 px mínimos.
export function LayoutMozo() {
  const { usuario } = useSesion();
  const { data: pedidos = [] } = useQuery(consultaPedidosActivos);
  // Mis pedidos con algo listo para llevar a la mesa
  const conListos = pedidos.filter((p) => p.mozo.id === usuario?.id && p.items.some((i) => i.estado === "LISTO")).length;

  const listosCambio = useCambio(conListos);

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="sticky top-0 z-20">
        <Cabecera />
        <FranjaCola />
      </div>

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
                    <span className="relative">
                      <Icono aria-hidden="true" weight={isActive ? "fill" : "regular"} className="size-7" />
                      {ruta === "pedidos" && conListos > 0 && (
                        <span
                          key={conListos}
                          className={`absolute -top-1.5 left-5 grid h-6 min-w-6 ${listosCambio ? "animate-pulso" : ""} place-items-center rounded-full bg-listo px-1.5 text-base leading-none font-bold text-tinta ring-2 ring-superficie`}
                        >
                          {conListos}
                          <span className="sr-only"> con platos listos</span>
                        </span>
                      )}
                    </span>
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
