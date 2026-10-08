import { CashRegisterIcon, CookingPotIcon, GearSixIcon, type Icon, MonitorIcon, MopedIcon, PlayIcon, SpeakerSlashIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useCallback } from "react";
import { Link, NavLink, Outlet } from "react-router";
import { Cabecera } from "../componentes/Cabecera";
import { Salir } from "../componentes/Salir";
import { abrirCocina, usePanel } from "../local/panel";
import { useAvisosNuevos } from "../local/useAvisosNuevos";
import { useSesion } from "../sesion/contexto";

// `escala` compensa los íconos cuyo dibujo ocupa menos de su caja: la moto es
// ancha y baja, y sin esto se ve más chica que la olla y la caja.
const PESTANAS: { ruta: string; nombre: string; icono: Icon; escala?: string }[] = [
  { ruta: "cocina", nombre: "Cocina", icono: CookingPotIcon },
  { ruta: "caja", nombre: "Caja", icono: CashRegisterIcon },
  { ruta: "delivery", nombre: "Delivery", icono: MopedIcon, escala: "scale-[1.2]" },
];

// Cocina y caja: una sola persona frente a un monitor, a veces lejos de él.
// Ancho completo, pestañas grandes y texto marino sobre blanco (contraste AAA).
export function LayoutLocal() {
  const { usuario } = useSesion();
  const { abierta, pantalla, sonido } = usePanel();
  // Los avisos de pedido nuevo suenan en cualquier pestaña del local
  const sinEmpezar = useAvisosNuevos();
  const medirCabecera = useCallback((cabecera: HTMLElement | null) => {
    if (!cabecera) return;
    const raiz = document.documentElement;
    const fijar = () => raiz.style.setProperty("--alto-cabecera", `${cabecera.offsetHeight}px`);
    fijar();
    const observador = new ResizeObserver(fijar);
    observador.observe(cabecera);
    return () => {
      observador.disconnect();
      raiz.style.removeProperty("--alto-cabecera");
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* La cabecera publica su alto (cambia cuando las pestañas bajan a una segunda fila):
          lo que queda fijo debajo, como el filtro de cocina, se apoya en él */}
      <div ref={medirCabecera} className="sticky top-0 z-20">
      <Cabecera
        acciones={
          <>
            {/* Solo el dueño: de la cocina a la administración sin cerrar sesión */}
            {usuario?.roles.includes("ADMIN") && (
              <Link
                to="/admin"
                aria-label="Administración"
                className="presionable inline-flex h-12 min-w-12 items-center justify-center gap-2 rounded-control bg-superficie px-3 text-lg font-bold text-marino hover:bg-primario-suave"
              >
                <GearSixIcon aria-hidden="true" weight="bold" className="size-6" />
                <span className="hidden xl:inline">Administración</span>
              </Link>
            )}
            <Salir />
          </>
        }
      >
        <nav aria-label="Secciones">
          <ul className="grid grid-cols-3 gap-1 rounded-control bg-superficie p-1 lg:inline-grid lg:min-w-[34rem]">
            {PESTANAS.map(({ ruta, nombre, icono: Icono, escala = "" }) => (
              <li key={ruta}>
                <NavLink
                  to={ruta}
                  className={({ isActive }) =>
                    `presionable relative flex min-h-12 items-center justify-center gap-2 rounded-interior px-3 text-lg font-bold lg:min-h-14 lg:text-2xl ${
                      isActive ? "text-white" : "text-marino hover:bg-primario-suave"
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <motion.span
                          layoutId="pestana-activa"
                          className="absolute inset-0 rounded-interior bg-marino"
                          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
                        />
                      )}
                      <Icono aria-hidden="true" weight={isActive ? "fill" : "regular"} className={`relative size-6 lg:size-8 ${escala}`} />
                      <span className="relative">{nombre}</span>
                      {ruta === "cocina" && sinEmpezar > 0 && (
                        <span className="relative grid h-8 min-w-8 place-items-center rounded-full bg-primario px-2 text-xl leading-none font-bold text-tinta lg:h-10 lg:min-w-10 lg:text-2xl">
                          {sinEmpezar}
                          <span className="sr-only"> sin empezar</span>
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </Cabecera>
      </div>

      {/* Quien usa lector de pantalla también se entera de que hay pedidos sin empezar */}
      <p aria-live="polite" className="sr-only">
        {sinEmpezar > 0 ? `${sinEmpezar === 1 ? "1 pedido" : `${sinEmpezar} pedidos`} sin empezar en cocina` : ""}
      </p>

      {abierta && !sonido && (
        <p role="alert" className="flex items-center gap-2.5 bg-alerta px-4 py-2 text-lg font-bold text-tinta lg:px-8 lg:text-xl">
          <SpeakerSlashIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
          Este equipo no pudo activar el sonido. Los pedidos nuevos solo se verán en pantalla.
        </p>
      )}

      {abierta && pantalla === "no-disponible" && (
        <p className="flex items-center gap-2.5 bg-alerta-suave px-4 py-2 text-lg font-bold text-alerta-fuerte lg:px-8 lg:text-xl">
          <MonitorIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
          Esta pantalla se puede apagar sola. Revisa el ahorro de energía del equipo.
        </p>
      )}

      <main className="flex w-full flex-1 flex-col px-4 py-5 lg:px-8 lg:py-5">
        {abierta ? (
          <Outlet />
        ) : (
          <>
            <AbrirCocina esperando={sinEmpezar} />
            {/* La ruta se resuelve igual (la pestaña queda marcada), pero su contenido espera a que se abra la cocina */}
            <div hidden>
              <Outlet />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// El navegador no deja sonar ni mantener la pantalla encendida sin un toque:
// la cocina se abre con uno, grande y a propósito. ("Turno" es palabra de la caja.)
function AbrirCocina({ esperando }: { esperando: number }) {
  return (
    <section className="m-auto flex w-full max-w-2xl flex-col items-center gap-6 py-8 text-center">
      <h1 className="text-3xl font-bold text-balance text-tinta lg:text-5xl">
        {esperando > 0 ? `${esperando === 1 ? "Hay 1 pedido" : `Hay ${esperando} pedidos`} esperando` : "Antes de empezar"}
      </h1>
      <button
        type="button"
        onClick={abrirCocina}
        className="presionable inline-flex min-h-24 w-full cursor-pointer items-center justify-center gap-4 rounded-panel bg-primario px-8 text-3xl font-bold text-tinta hover:bg-primario-presionado lg:min-h-32 lg:text-5xl"
      >
        <PlayIcon aria-hidden="true" weight="fill" className="size-9 lg:size-12" />
        Abrir cocina
      </button>
      <p className="max-w-[36ch] text-xl text-pretty text-marino lg:text-2xl">
        Este botón activa el sonido de los pedidos nuevos y deja la pantalla encendida. Vas a oír el aviso una vez, para
        comprobar el volumen.
      </p>
    </section>
  );
}
