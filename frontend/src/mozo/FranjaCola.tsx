import { CaretRightIcon, CircleNotchIcon, CloudSlashIcon } from "@phosphor-icons/react";
import { plural } from "../lib/formato";
import { abrirCola, useMozo } from "./almacen";

// Siempre a la vista mientras haya algo que no llegó a cocina. No aparece
// durante un envío normal (dura un instante): solo cuando ya falló una vez.
export function FranjaCola() {
  const { cola, enviando } = useMozo();
  const atascados = cola.filter((e) => e.intentos > 0 || e.estado === "conflicto");
  if (atascados.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => abrirCola(true)}
      className="presionable flex min-h-12 w-full cursor-pointer items-center gap-2.5 bg-alerta px-4 py-2 text-left text-lg font-bold text-tinta"
    >
      {enviando ? (
        <CircleNotchIcon aria-hidden="true" weight="bold" className="size-6 shrink-0 animate-spin" />
      ) : (
        <CloudSlashIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
      )}
      <span className="flex-1">{plural(atascados.length, "pedido por enviar", "pedidos por enviar")}</span>
      <span className="inline-flex items-center gap-1 underline decoration-2 underline-offset-4">
        Ver
        <CaretRightIcon aria-hidden="true" weight="bold" className="size-5" />
      </span>
    </button>
  );
}
