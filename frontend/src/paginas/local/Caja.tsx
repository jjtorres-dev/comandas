import { CashRegisterIcon } from "@phosphor-icons/react";
import { PantallaVacia } from "../../componentes/PantallaVacia";

export function Caja() {
  return <PantallaVacia titulo="Caja" icono={CashRegisterIcon} texto="Aquí se abrirá el turno de caja y se cobrarán los pedidos." />;
}
