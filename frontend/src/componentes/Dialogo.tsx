import { XIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useId, useRef } from "react";

type Props = {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children: ReactNode;
  // Acciones al pie
  pie?: ReactNode;
};

// Diálogo centrado de /local (monitor con mouse y teclado). <dialog> modal: el
// navegador atrapa el foco, bloquea lo de atrás y lo cierra con Escape.
export function Dialogo({ abierto, alCerrar, titulo, children, pie }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const nodo = dialogo.current;
    if (!nodo) return;
    if (abierto && !nodo.open) {
      nodo.showModal();
      // El navegador pondría el foco en la X: lo útil es empezar a escribir
      nodo.querySelector<HTMLElement>("input:not([type=checkbox]):not(:disabled), textarea")?.focus();
    }
    if (!abierto && nodo.open) nodo.close();
  }, [abierto]);

  return (
    <dialog ref={dialogo} className="dialogo" aria-labelledby={idTitulo} onClose={() => abierto && alCerrar()}>
      <header className="flex shrink-0 items-center gap-3 border-b-2 border-borde py-2 pr-2 pl-5">
        <h2 id={idTitulo} className="min-w-0 flex-1 text-2xl leading-tight font-bold text-balance text-tinta">
          {titulo}
        </h2>
        <button
          type="button"
          onClick={alCerrar}
          aria-label="Cerrar"
          className="presionable grid size-12 shrink-0 cursor-pointer place-items-center rounded-control text-marino hover:bg-primario-suave"
        >
          <XIcon aria-hidden="true" weight="bold" className="size-7" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {pie && <footer className="shrink-0 border-t-2 border-borde px-5 py-3">{pie}</footer>}
    </dialog>
  );
}
