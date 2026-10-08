import { CheckIcon, PencilSimpleIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { useGuardar } from "../../../admin/guardar";
import { api } from "../../../lib/api";
import { soles } from "../../../lib/formato";
import type { Variante } from "../../../lib/tipos";
import { leerMonto, paraApi } from "../../../local/dinero";

type Props = {
  variante: Variante;
  plato: string;
  // Con varios precios, cada uno lleva su nombre ("Fuente")
  conNombre: boolean;
};

// Un precio de la lista: se toca, se escribe el nuevo y se guarda con Enter o
// con "Guardar", sin abrir la ficha del plato.
export function PrecioEditable({ variante, plato, conNombre }: Props) {
  const [texto, setTexto] = useState<string | null>(null);
  const { guardar, ocupado } = useGuardar();
  const de = conNombre ? `${plato}, ${variante.nombre}` : plato;

  if (texto === null) {
    return (
      <button
        type="button"
        onClick={() => setTexto(Number(variante.precio).toFixed(2))}
        aria-label={`Cambiar precio de ${de}: ${soles(variante.precio)}`}
        className="presionable inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-control border-2 border-borde-fuerte bg-superficie px-3 text-xl font-bold text-tinta hover:border-marino hover:bg-primario-suave"
      >
        {conNombre && <span className="text-lg font-normal text-marino">{variante.nombre}</span>}
        <span className="tabular-nums">{soles(variante.precio)}</span>
        <PencilSimpleIcon aria-hidden="true" weight="bold" className="size-5 text-texto-suave" />
      </button>
    );
  }

  const monto = leerMonto(texto);
  const enviar = async () => {
    if (monto === null) return;
    if (monto === Math.round(Number(variante.precio) * 100)) return setTexto(null);
    const listo = await guardar(
      () => api(`/admin/variantes/${variante.id}/precio`, { metodo: "PATCH", cuerpo: { precio: paraApi(monto) } }),
      `${de}: ahora ${soles(monto / 100)}`,
    );
    if (listo) setTexto(null);
  };

  return (
    <form
      className="flex flex-wrap items-center gap-2 rounded-control bg-primario-suave p-1.5"
      onSubmit={(evento) => {
        evento.preventDefault();
        void enviar();
      }}
      onKeyDown={(evento) => evento.key === "Escape" && setTexto(null)}
    >
      {conNombre && <span className="pl-2 text-lg text-marino">{variante.nombre}</span>}
      <label className="flex items-center gap-2 text-xl font-bold text-tinta">
        <span aria-hidden="true">S/</span>
        <span className="sr-only">Precio nuevo de {de}, en soles</span>
        <input
          // El dueño acaba de tocar el precio: el cursor va directo ahí
          autoFocus
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          onFocus={(evento) => evento.target.select()}
          aria-invalid={monto === null || undefined}
          className={`h-12 w-24 rounded-interior border-2 bg-superficie px-3 text-xl font-bold text-tinta tabular-nums ${monto === null ? "border-peligro" : "border-marino"}`}
        />
      </label>
      <button
        type="submit"
        disabled={monto === null || ocupado}
        className="presionable inline-flex h-12 cursor-pointer items-center gap-2 rounded-interior bg-primario px-4 text-lg font-bold text-tinta hover:bg-primario-presionado disabled:cursor-not-allowed disabled:opacity-60"
      >
        <CheckIcon aria-hidden="true" weight="bold" className="hidden size-5 sm:block" />
        Guardar
      </button>
      <button
        type="button"
        onClick={() => setTexto(null)}
        aria-label="No cambiar el precio"
        className="presionable grid size-12 cursor-pointer place-items-center rounded-interior text-marino hover:bg-superficie"
      >
        <XIcon aria-hidden="true" weight="bold" className="size-6" />
      </button>
      {monto === null && (
        <p role="alert" className="basis-full px-2 pb-1 text-base font-bold text-peligro">
          Escribe el precio en soles, por ejemplo 20.50
        </p>
      )}
    </form>
  );
}
