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

// Con cantidad: "1 listo", "2 pendientes" (el detalle de cocina en la cuenta de la mesa)
const CONTADOS: Partial<Record<EstadoPedido, [uno: string, varios: string]>> = {
  PENDIENTE: ["pendiente", "pendientes"],
  PREPARANDO: ["preparando", "preparando"],
  LISTO: ["listo", "listos"],
  ENTREGADO: ["entregado", "entregados"],
};

export function PildoraEstado({ estado, cantidad }: { estado: EstadoPedido; cantidad?: number }) {
  const { icono: Icono, clases } = ESTADOS[estado];
  const contado = cantidad === undefined ? undefined : CONTADOS[estado];
  const texto = contado ? `${cantidad} ${contado[cantidad === 1 ? 0 : 1]}` : ESTADOS[estado].texto;
  const cambio = useCambio(estado);
  return (
    // La clave reinicia la animación: el estado "llega" una sola vez al cambiar
    <span key={estado} className={`inline-flex h-8 shrink-0 ${cambio ? "animate-llegada" : ""} items-center gap-1.5 rounded-full px-3 text-base font-bold ${clases}`}>
      <Icono aria-hidden="true" weight={estado === "LISTO" ? "fill" : "bold"} className="size-5" />
      {texto}
    </span>
  );
}
