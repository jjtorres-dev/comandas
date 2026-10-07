import { ReceiptIcon } from "@phosphor-icons/react";
import { PantallaVacia } from "../../componentes/PantallaVacia";

export function Pedidos() {
  return <PantallaVacia titulo="Pedidos" icono={ReceiptIcon} texto="Aquí verás los pedidos en curso y cuáles ya están listos para servir." />;
}
