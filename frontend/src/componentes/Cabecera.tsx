import type { ReactNode } from "react";
import { useSesion } from "../sesion/contexto";
import { IndicadorConexion } from "./IndicadorConexion";
import { LogoNegocio } from "./LogoNegocio";

type Props = {
  // Navegación que vive dentro de la cabecera (pestañas del local)
  children?: ReactNode;
  // Controles a la derecha, después del indicador de conexión
  acciones?: ReactNode;
};

// Franja turquesa con la marca del negocio (siempre desde la API) y el
// estado de la conexión.
export function Cabecera({ children, acciones }: Props) {
  const { negocio } = useSesion();

  return (
    <header className="sticky top-0 z-20 bg-primario pt-[env(safe-area-inset-top)] text-tinta">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-2.5 lg:px-8 lg:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none">
          {negocio && <LogoNegocio nombre={negocio.nombre} logoUrl={negocio.logoUrl} className="size-11 lg:size-14" />}
          <p className="line-clamp-2 text-xl leading-tight font-bold text-balance lg:text-2xl">{negocio?.nombre}</p>
        </div>
        {children && <div className="order-last w-full lg:order-none lg:ml-4 lg:w-auto lg:flex-1">{children}</div>}
        <div className="flex shrink-0 items-center gap-3">
          <IndicadorConexion />
          {acciones}
        </div>
      </div>
    </header>
  );
}
