import { ArrowDownIcon, ArrowUpIcon, EyeSlashIcon, type Icon } from "@phosphor-icons/react";
import type { ReactNode } from "react";

// Título de una sección de /admin, con su acción principal al lado
export function Titulo({ titulo, texto, accion }: { titulo: string; texto?: string; accion?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-3xl font-bold text-balance text-tinta lg:text-4xl">{titulo}</h1>
        {texto && <p className="mt-1 max-w-[60ch] text-lg text-pretty text-marino">{texto}</p>}
      </div>
      {accion}
    </div>
  );
}

// Botón cuadrado de una sola acción (subir, bajar, editar)
export function BotonIcono({ nombre, icono: Icono, ...resto }: { nombre: string; icono: Icon } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-label={nombre}
      title={nombre}
      {...resto}
      className="presionable grid size-12 shrink-0 cursor-pointer place-items-center rounded-control border-2 border-borde-fuerte bg-superficie text-marino hover:bg-primario-suave disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icono aria-hidden="true" weight="bold" className="size-6" />
    </button>
  );
}

// Subir y bajar un elemento en su lista: el orden en que lo ve el personal
export function Orden({ de, primero, ultimo, alMover, ocupado }: { de: string; primero: boolean; ultimo: boolean; alMover: (direccion: "subir" | "bajar") => void; ocupado: boolean }) {
  return (
    <div className="flex shrink-0 gap-2">
      <BotonIcono nombre={`Subir ${de}`} icono={ArrowUpIcon} disabled={primero || ocupado} onClick={() => alMover("subir")} />
      <BotonIcono nombre={`Bajar ${de}`} icono={ArrowDownIcon} disabled={ultimo || ocupado} onClick={() => alMover("bajar")} />
    </div>
  );
}

// Lo desactivado sigue en la lista del dueño, pero el personal ya no lo ve
export function Desactivado({ texto = "Desactivado" }: { texto?: string }) {
  return (
    <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-fondo px-3 text-base font-bold text-marino">
      <EyeSlashIcon aria-hidden="true" weight="bold" className="size-5" />
      {texto}
    </span>
  );
}

export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-panel border-2 border-borde bg-superficie p-4 lg:p-6 ${className}`}>{children}</section>;
}

// Por qué algo no se puede eliminar, dicho sin tecnicismos
export function NotaDeHistorial({ children }: { children: ReactNode }) {
  return <p className="rounded-control bg-fondo px-4 py-3 text-base text-pretty text-marino">{children}</p>;
}
