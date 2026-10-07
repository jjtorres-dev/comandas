import { type Icon, MopedIcon, PicnicTableIcon, ShoppingBagIcon } from "@phosphor-icons/react";
import type { TipoPedido } from "../lib/tipos";

// Cada tipo de pedido tiene su color, su ícono y su palabra, iguales en cocina
// y en caja. El naranja es el de Delivery (excepción de /local a la regla del
// acento); ámbar, rojo y lima quedan libres para "tarda", "muy tarde" y "listo".
export const TIPOS: Record<TipoPedido, { icono: Icon; clases: string }> = {
  MESA: { icono: PicnicTableIcon, clases: "border-b-[3px] border-tinta bg-superficie" },
  PARA_LLEVAR: { icono: ShoppingBagIcon, clases: "bg-primario" },
  DELIVERY: { icono: MopedIcon, clases: "bg-acento" },
};
