import { ArrowLeftIcon } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { IndicadorConexion } from "./IndicadorConexion";

type Props = {
  titulo: string;
  // Segunda línea: número de pedido, "Ronda nueva"…
  detalle?: ReactNode;
  // A dónde lleva la flecha, y cómo se anuncia ("Volver a Mesas")
  volverA: string;
  volverTexto: string;
};

// Cabecera de las pantallas de una sola tarea (tomar pedido, resumen, mesa):
// dice dónde estás y cómo volver, con la misma franja turquesa del resto.
export function CabeceraPantalla({ titulo, detalle, volverA, volverTexto }: Props) {
  return (
    <header className="bg-primario pt-[env(safe-area-inset-top)] text-tinta">
      <div className="flex items-center gap-2 py-2 pr-4 pl-2">
        <Link
          to={volverA}
          aria-label={volverTexto}
          className="presionable grid size-12 shrink-0 place-items-center rounded-control hover:bg-primario-presionado"
        >
          <ArrowLeftIcon aria-hidden="true" weight="bold" className="size-7" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl leading-tight font-bold">{titulo}</h1>
          {detalle && <p className="truncate text-base leading-snug font-bold">{detalle}</p>}
        </div>
        <IndicadorConexion />
      </div>
    </header>
  );
}
