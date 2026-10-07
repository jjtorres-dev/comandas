import { XIcon } from "@phosphor-icons/react";
import { type ReactNode, useEffect, useId, useRef } from "react";

type Props = {
  abierta: boolean;
  alCerrar: () => void;
  titulo: string;
  // Línea bajo el título (p. ej. el contador de un combo)
  detalle?: ReactNode;
  children: ReactNode;
  // Acciones fijas al pie, siempre al alcance del pulgar
  pie?: ReactNode;
};

// Hoja que sube desde abajo para una decisión corta (variante, combo, notas).
// Es un <dialog> modal: el navegador atrapa el foco, bloquea lo de atrás y
// la cierra con Escape. Quien la usa conserva el contenido mientras se cierra
// (ver useUltimo).
export function HojaInferior({ abierta, alCerrar, titulo, detalle, children, pie }: Props) {
  const dialogo = useRef<HTMLDialogElement>(null);
  const idTitulo = useId();

  useEffect(() => {
    const nodo = dialogo.current;
    if (!nodo) return;
    if (abierta && !nodo.open) nodo.showModal();
    if (!abierta && nodo.open) nodo.close();
  }, [abierta]);

  // Con el teclado abierto la hoja se ajusta al espacio que queda visible, y su
  // pie (el botón de acción) queda siempre encima del teclado. En Android el
  // meta viewport (interactive-widget=resizes-content) ya encoge la página;
  // donde no, se compensa aquí con visualViewport.
  useEffect(() => {
    const nodo = dialogo.current;
    const visible = window.visualViewport;
    if (!abierta || !nodo || !visible) return;

    const ajustar = () => {
      const tapado = Math.max(0, window.innerHeight - visible.height - visible.offsetTop);
      nodo.style.bottom = `${tapado}px`;
      nodo.style.setProperty("--alto-visible", `${visible.height}px`);
      // Con poco alto (teclado abierto) la hoja usa todo el espacio visible
      nodo.toggleAttribute("data-compacta", visible.height < 560);
      const campo = document.activeElement;
      if (campo instanceof HTMLElement && nodo.contains(campo) && campo.matches("input, textarea")) {
        campo.scrollIntoView({ block: "nearest" });
      }
    };
    ajustar();
    visible.addEventListener("resize", ajustar);
    visible.addEventListener("scroll", ajustar);
    return () => {
      visible.removeEventListener("resize", ajustar);
      visible.removeEventListener("scroll", ajustar);
    };
  }, [abierta]);

  return (
    <dialog
      ref={dialogo}
      className="hoja"
      aria-labelledby={idTitulo}
      onClose={() => abierta && alCerrar()}
      // Un toque fuera de la hoja (sobre el fondo oscuro) la cierra
      onClick={(evento) => evento.target === dialogo.current && alCerrar()}
    >
      <header className="flex shrink-0 items-start gap-3 border-b-2 border-borde py-3 pr-2 pl-5">
        <div className="min-w-0 flex-1 py-1.5">
          <h2 id={idTitulo} className="text-2xl leading-tight font-bold text-balance text-tinta">
            {titulo}
          </h2>
          {detalle && <div className="mt-1 text-lg text-marino">{detalle}</div>}
        </div>
        <button
          type="button"
          onClick={alCerrar}
          aria-label="Cerrar"
          className="presionable grid size-12 shrink-0 cursor-pointer place-items-center rounded-control text-marino hover:bg-primario-suave"
        >
          <XIcon aria-hidden="true" weight="bold" className="size-7" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
      {pie && (
        <footer className="shrink-0 border-t-2 border-borde px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">{pie}</footer>
      )}
    </dialog>
  );
}
