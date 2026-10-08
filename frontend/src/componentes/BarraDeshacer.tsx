import { ArrowCounterClockwiseIcon } from "@phosphor-icons/react";

type Props = {
  // Cambia con cada acción: reinicia la cuenta atrás
  clave: number | string;
  texto: string;
  alDeshacer: () => void;
  alCerrar: () => void;
};

const BOTON = "presionable inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-control px-4 text-center leading-tight font-bold";

// Tras un cambio de estado, unos segundos para arrepentirse con un botón
// grande. En monitor va en línea (en la fila de arriba, donde no tapa nada);
// en celular, fija abajo, junto al pulgar. La usan Cocina y Delivery.
export function BarraDeshacer({ clave, texto, alDeshacer, alCerrar }: Props) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:static lg:z-auto lg:min-w-0 lg:flex-1 lg:justify-end lg:p-0">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-panel border-[3px] border-tinta bg-superficie shadow-barra lg:rounded-control lg:shadow-none"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 lg:flex-nowrap lg:gap-4 lg:px-4 lg:py-1">
          <p className="min-w-0 basis-full text-xl leading-tight font-bold text-tinta lg:flex-1 lg:basis-auto lg:text-2xl">{texto}</p>
          <button
            type="button"
            onClick={alDeshacer}
            className={`${BOTON} min-h-16 flex-1 border-2 border-marino bg-superficie text-2xl text-marino hover:bg-primario-suave lg:min-h-12 lg:flex-none lg:px-8`}
          >
            <ArrowCounterClockwiseIcon aria-hidden="true" weight="bold" className="size-7 shrink-0" />
            Deshacer
          </button>
          <button
            type="button"
            onClick={alCerrar}
            className={`${BOTON} min-h-16 shrink-0 text-xl text-marino underline decoration-2 underline-offset-4 lg:min-h-12 lg:text-2xl`}
          >
            Cerrar
          </button>
        </div>
        {/* La línea se acorta con el tiempo que queda. La clave la reinicia con cada cambio. */}
        <div key={clave} aria-hidden="true" className="h-1.5 origin-left animate-cuenta bg-primario-fuerte" />
      </div>
    </div>
  );
}
