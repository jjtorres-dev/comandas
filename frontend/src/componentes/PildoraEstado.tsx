import { BellRingingIcon, CheckIcon, CookingPotIcon, HourglassMediumIcon, type Icon, MopedIcon, XIcon } from "@phosphor-icons/react";
import type { EstadoPedido } from "../lib/tipos";
import { useCambio } from "../lib/useCambio";

// Cada estado lleva ícono y palabra, nunca solo color
const ESTADOS: Record<EstadoPedido, { texto: string; icono: Icon; clases: string }> = {
  PENDIENTE: { texto: "Pendiente", icono: HourglassMediumIcon, clases: "bg-fondo text-marino" },
  PREPARANDO: { texto: "Preparando", icono: CookingPotIcon, clases: "bg-alerta-suave text-alerta-fuerte" },
  LISTO: { texto: "Listo", icono: BellRingingIcon, clases: "bg-listo text-tinta" },
  EN_CAMINO: { texto: "En camino", icono: MopedIcon, clases: "bg-primario-suave text-tinta" },
  ENTREGADO: { texto: "Entregado", icono: CheckIcon, clases: "bg-primario-suave text-primario-profundo" },
  CANCELADO: { texto: "Cancelado", icono: XIcon, clases: "bg-peligro-suave text-peligro" },
};

export function PildoraEstado({ estado }: { estado: EstadoPedido }) {
  const { texto, icono: Icono, clases } = ESTADOS[estado];
  const cambio = useCambio(estado);
  return (
    // La clave reinicia la animación: el estado "llega" una sola vez al cambiar
    <span key={estado} className={`inline-flex h-8 shrink-0 ${cambio ? "animate-llegada" : ""} items-center gap-1.5 rounded-full px-3 text-base font-bold ${clases}`}>
      <Icono aria-hidden="true" weight={estado === "LISTO" ? "fill" : "bold"} className="size-5" />
      {texto}
    </span>
  );
}
