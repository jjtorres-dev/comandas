import { WarningIcon } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import { Dialogo } from "../../componentes/Dialogo";

type Props = {
  titulo: string;
  // Hay algo escrito que todavía no se guardó
  sinGuardar: boolean;
  alCerrar: () => void;
  children: ReactNode;
  pie: ReactNode;
};

// Diálogo de las fichas de /admin. Cerrarlo (X, Escape) con cambios a medias
// pregunta primero, igual que al modificar un pedido en Delivery: nada se
// pierde en silencio. El aviso va en el pie, que siempre está a la vista.
export function Ficha({ titulo, sinGuardar, alCerrar, children, pie }: Props) {
  const [avisando, setAvisando] = useState(false);
  const cerrar = () => (sinGuardar && !avisando ? setAvisando(true) : alCerrar());

  return (
    <Dialogo
      abierto
      alCerrar={cerrar}
      titulo={titulo}
      pie={
        <div className="flex flex-col gap-3">
          {avisando && sinGuardar && (
            <p role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-control bg-alerta px-4 py-2.5 text-lg font-bold text-tinta">
              <WarningIcon aria-hidden="true" weight="fill" className="size-6 shrink-0" />
              <span className="min-w-0 flex-1 basis-40">Hay cambios sin guardar.</span>
              <button type="button" onClick={() => setAvisando(false)} className="min-h-12 cursor-pointer rounded-control bg-superficie px-4 underline decoration-2 underline-offset-4">
                Seguir aquí
              </button>
              <button type="button" onClick={alCerrar} className="min-h-12 cursor-pointer px-2 underline decoration-2 underline-offset-4">
                Salir sin guardar
              </button>
            </p>
          )}
          {pie}
        </div>
      }
    >
      {children}
    </Dialogo>
  );
}
