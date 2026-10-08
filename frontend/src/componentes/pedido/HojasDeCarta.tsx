// Hojas para elegir la variante de un plato y los platos de un combo. Las usan
// la app del mozo y el pedido por teléfono de /local.
import { MinusIcon, PlusIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { soles } from "../../lib/formato";
import type { OpcionCombo, Producto, Variante } from "../../lib/tipos";
import { useUltimo } from "../../lib/useUltimo";
import { Boton } from "../Boton";
import { HojaInferior } from "../HojaInferior";

// Si la variante ya se llama como su precio ("S/ 10"), no se repite
const nombraSuPrecio = (v: Variante) => Number(v.nombre.replace(/[^\d.]/g, "")) === Number(v.precio);

export function HojaVariantes({
  producto,
  alCerrar,
  alElegir,
}: {
  producto: Producto | null;
  alCerrar: () => void;
  alElegir: (producto: Producto, variante: Variante) => void;
}) {
  const visible = useUltimo(producto);
  return (
    <HojaInferior abierta={producto !== null} alCerrar={alCerrar} titulo={visible?.nombre ?? ""} detalle="¿Cuál?">
      <ul className="flex flex-col gap-3">
        {visible?.variantes.map((variante) => (
          <li key={variante.id}>
            <button
              type="button"
              onClick={() => alElegir(visible, variante)}
              className="presionable flex min-h-16 w-full cursor-pointer items-center justify-between gap-3 rounded-control border-2 border-borde-fuerte bg-superficie px-5 text-left text-xl font-bold text-tinta hover:bg-primario-suave"
            >
              {nombraSuPrecio(variante) ? (
                <span className="tabular-nums">{soles(variante.precio)}</span>
              ) : (
                <>
                  <span>{variante.nombre}</span>
                  <span className="tabular-nums">{soles(variante.precio)}</span>
                </>
              )}
              <PlusIcon aria-hidden="true" weight="bold" className="size-6 shrink-0 text-primario-profundo" />
            </button>
          </li>
        ))}
      </ul>
    </HojaInferior>
  );
}

export function HojaCombo({
  producto,
  alCerrar,
  alAgregar,
}: {
  producto: Producto | null;
  alCerrar: () => void;
  alAgregar: (producto: Producto, componentes: OpcionCombo[]) => void;
}) {
  const [elegidos, setElegidos] = useState<Record<string, number>>({});
  // Cada combo empieza de cero
  const [previo, setPrevio] = useState(producto);
  if (producto !== previo) {
    setPrevio(producto);
    if (producto) setElegidos({});
  }

  const visible = useUltimo(producto);
  const necesarios = visible?.comboCantidad ?? 0;
  const llevan = Object.values(elegidos).reduce((suma, n) => suma + n, 0);
  const completo = llevan === necesarios;
  const cambiar = (id: string, delta: number) => setElegidos((e) => ({ ...e, [id]: Math.max(0, (e[id] ?? 0) + delta) }));

  return (
    <HojaInferior
      abierta={producto !== null}
      alCerrar={alCerrar}
      titulo={visible?.nombre ?? ""}
      detalle={
        <p aria-live="polite" className="font-bold tabular-nums">
          <span key={llevan} className={`inline-block animate-pulso text-2xl ${completo ? "text-listo-fuerte" : "text-tinta"}`}>
            {llevan} de {necesarios}
          </span>{" "}
          {completo ? "platos: completo" : "platos elegidos. Se puede repetir."}
        </p>
      }
      pie={
        <Boton
          className="disabled:border-2 disabled:border-borde-fuerte disabled:bg-fondo disabled:text-marino disabled:opacity-100"
          disabled={!completo}
          onClick={() =>
            producto && alAgregar(producto, producto.opcionesCombo.flatMap((o) => Array.from({ length: elegidos[o.productoId] ?? 0 }, () => o)))
          }
        >
          {completo ? "Agregar combo" : `Faltan ${necesarios - llevan}`}
        </Boton>
      }
    >
      <ul className="flex flex-col divide-y-2 divide-borde">
        {visible?.opcionesCombo.map((opcion) => {
          const cantidad = elegidos[opcion.productoId] ?? 0;
          return (
            <li key={opcion.productoId} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 text-xl leading-tight font-bold text-tinta">{opcion.nombre}</span>
              <button
                type="button"
                onClick={() => cambiar(opcion.productoId, -1)}
                disabled={cantidad === 0}
                aria-label={`Quitar ${opcion.nombre}`}
                className="presionable grid size-12 shrink-0 cursor-pointer place-items-center rounded-control border-2 border-marino text-marino disabled:cursor-not-allowed disabled:border-borde disabled:text-borde-fuerte"
              >
                <MinusIcon aria-hidden="true" weight="bold" className="size-6" />
              </button>
              <span className="w-7 text-center text-2xl font-bold text-tinta tabular-nums">{cantidad}</span>
              <button
                type="button"
                onClick={() => cambiar(opcion.productoId, 1)}
                disabled={completo}
                aria-label={`Agregar ${opcion.nombre}`}
                className="presionable grid size-12 shrink-0 cursor-pointer place-items-center rounded-control bg-primario text-tinta disabled:cursor-not-allowed disabled:bg-fondo disabled:text-borde-fuerte"
              >
                <PlusIcon aria-hidden="true" weight="bold" className="size-6" />
              </button>
            </li>
          );
        })}
      </ul>
    </HojaInferior>
  );
}
