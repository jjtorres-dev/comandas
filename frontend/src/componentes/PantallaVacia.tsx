import type { Icon } from "@phosphor-icons/react";

type Props = { titulo: string; texto: string; icono: Icon };

// Contenido de una sección que todavía no se construye: deja claro qué va a
// vivir ahí sin simular datos.
export function PantallaVacia({ titulo, texto, icono: Icono }: Props) {
  return (
    <section className="flex h-full flex-col gap-5">
      <h1 className="text-3xl font-bold text-balance text-tinta lg:text-4xl">{titulo}</h1>
      <div className="flex min-h-64 flex-1 flex-col items-center justify-center gap-4 rounded-panel border-2 border-dashed border-borde-fuerte px-6 py-10 text-center">
        <Icono aria-hidden="true" weight="duotone" className="size-16 text-primario-fuerte lg:size-20" />
        <p className="max-w-[40ch] text-xl text-pretty text-marino lg:text-2xl">{texto}</p>
      </div>
    </section>
  );
}
