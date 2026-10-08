import { MinusIcon, NotePencilIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { HojaNotas } from "../../../componentes/pedido/HojaNotas";
import { platosDeCombo } from "../../../lib/formato";
import type { NotaRapida } from "../../../lib/tipos";
import { soles } from "../../../local/dinero";
import { cambiarCantidad, type Linea, ponerNotas } from "../../../mozo/lineas";

type Props = { lineas: Linea[]; alCambiar: (lineas: Linea[]) => void; notasRapidas: NotaRapida[]; vacio: string };

const CUADRADO = "presionable grid size-12 shrink-0 cursor-pointer place-items-center rounded-control";

// Lo anotado hasta ahora: cantidad, nota y quitar, con la misma lógica de
// líneas (y la misma hoja de notas) que el resumen del mozo
export function Lineas({ lineas, alCambiar, notasRapidas, vacio }: Props) {
  const [conNotas, setConNotas] = useState<Linea | null>(null);

  if (lineas.length === 0) {
    return <p className="rounded-control border-2 border-dashed border-borde-fuerte px-4 py-5 text-center text-lg text-texto-suave">{vacio}</p>;
  }

  return (
    <>
      <ul aria-label="Platos anotados" className="flex flex-col divide-y-2 divide-borde rounded-control border-2 border-borde-fuerte">
        {lineas.map((linea) => (
          <li key={linea.id} className="flex flex-col gap-2 p-2.5">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xl leading-tight font-bold text-tinta">{linea.nombre}</p>
                {linea.componentes.length > 0 && <p className="text-lg leading-snug text-marino">{platosDeCombo(linea.componentes.map((c) => c.nombre))}</p>}
              </div>
              <p className="shrink-0 text-xl font-bold text-tinta tabular-nums">{soles(Math.round(linea.precio * 100) * linea.cantidad)}</p>
            </div>
            {linea.notas.length > 0 && (
              <ul aria-label="Notas" className="flex flex-wrap gap-1.5">
                {linea.notas.map((nota) => (
                  <li key={nota} className="rounded-interior border-2 border-borde-fuerte bg-fondo px-2 py-0.5 text-lg leading-tight font-bold text-tinta">
                    {nota}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConNotas(linea)}
                className="presionable mr-auto inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-control border-2 border-marino px-3 text-lg font-bold text-marino hover:bg-primario-suave"
              >
                <NotePencilIcon aria-hidden="true" weight="bold" className="size-5 shrink-0" />
                {linea.notas.length > 0 ? "Cambiar nota" : "Nota"}
              </button>
              <button
                type="button"
                onClick={() => alCambiar(cambiarCantidad(lineas, linea.id, -1))}
                aria-label={linea.cantidad === 1 ? `Quitar ${linea.nombre}` : `Uno menos de ${linea.nombre}`}
                className={`${CUADRADO} border-2 border-marino text-marino hover:bg-primario-suave`}
              >
                {linea.cantidad === 1 ? <TrashIcon aria-hidden="true" weight="bold" className="size-6" /> : <MinusIcon aria-hidden="true" weight="bold" className="size-6" />}
              </button>
              <span aria-label={`Cantidad: ${linea.cantidad}`} className="w-8 text-center text-2xl font-bold text-tinta tabular-nums">
                {linea.cantidad}
              </span>
              <button
                type="button"
                onClick={() => alCambiar(cambiarCantidad(lineas, linea.id, 1))}
                aria-label={`Uno más de ${linea.nombre}`}
                className={`${CUADRADO} bg-primario text-tinta hover:bg-primario-presionado`}
              >
                <PlusIcon aria-hidden="true" weight="bold" className="size-6" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <HojaNotas
        linea={conNotas}
        notasRapidas={notasRapidas}
        alCerrar={() => setConNotas(null)}
        alGuardar={(notas, alcance, notasCombo) => {
          if (conNotas) alCambiar(ponerNotas(lineas, conNotas.id, notas, alcance, notasCombo));
          setConNotas(null);
        }}
      />
    </>
  );
}
