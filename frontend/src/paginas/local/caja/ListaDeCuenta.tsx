import type { ReactNode } from "react";
import { platosDeCombo } from "../../../lib/formato";
import type { Cuenta } from "../../../lib/tipos";
import { centimos, soles } from "../../../local/dinero";

// La lista de una cuenta, igual al cobrar y en "Cobrados de este turno":
// "6× Cerveza Pilsen  S/ 54.00", con los platos del combo y las notas debajo.

export type LineaMostrada = {
  cantidad: number;
  nombre: string;
  componentes: string[];
  notas?: string[];
  // Lo que suma la línea, en céntimos
  centimos: number;
};

type PropsDeFila = {
  linea: LineaMostrada;
  // Filas más bajas, para ver muchas cuentas de un vistazo
  compacta?: boolean;
  // Ya pagada: en gris
  apagada?: boolean;
  // Bajo el nombre ("1 de 2 pagado")
  estado?: ReactNode;
  // Entre el nombre y el monto (marcar para cobrar por platos)
  control?: ReactNode;
};

export function FilaDeCuenta({ linea, compacta = false, apagada = false, estado, control }: PropsDeFila) {
  return (
    // En pantallas angostas, el control para marcar baja a su propia línea: el nombre no se aplasta
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-2 ${compacta ? "py-1.5" : "py-2.5"} ${apagada ? "text-texto-suave" : "text-tinta"}`}>
      <span className={`w-10 shrink-0 font-bold tabular-nums ${compacta ? "text-xl" : "text-2xl"}`}>{linea.cantidad}×</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl leading-tight font-bold wrap-anywhere">{linea.nombre}</span>
        {linea.componentes.length > 0 && <span className="block text-lg leading-snug">{platosDeCombo(linea.componentes)}</span>}
        {linea.notas && linea.notas.length > 0 && <span className="block text-lg leading-snug wrap-anywhere text-marino">{linea.notas.join(" · ")}</span>}
        {estado}
      </span>
      {control}
      <span className="w-24 shrink-0 text-right text-xl font-bold tabular-nums">{soles(linea.centimos)}</span>
    </li>
  );
}

// Sin `totalPagado` no se muestra lo ya pagado ni el saldo: los pagos van aparte
type Montos = Pick<Cuenta, "subtotal" | "costoEnvio" | "cantidadTapers" | "cargoTapers" | "descuento" | "total"> &
  Partial<Pick<Cuenta, "totalPagado" | "saldoPendiente">>;

// Los montos son los del servidor, tal cual
export function Totales({ cuenta }: { cuenta: Montos }) {
  const fila = (nombre: string, monto: string, signo = "") => (
    <div className="flex justify-between gap-3">
      <dt>{nombre}</dt>
      <dd>
        {signo}
        {soles(centimos(monto))}
      </dd>
    </div>
  );
  const conCargos = centimos(cuenta.costoEnvio) > 0 || centimos(cuenta.cargoTapers) > 0 || centimos(cuenta.descuento) > 0;
  return (
    <dl className="flex flex-col gap-1 border-t-2 border-borde pt-3 text-xl tabular-nums">
      {conCargos && fila("Subtotal", cuenta.subtotal)}
      {centimos(cuenta.costoEnvio) > 0 && fila("Envío", cuenta.costoEnvio)}
      {centimos(cuenta.cargoTapers) > 0 && fila(`Tapers (${cuenta.cantidadTapers})`, cuenta.cargoTapers)}
      {centimos(cuenta.descuento) > 0 && fila("Descuento", cuenta.descuento, "− ")}
      <div className="flex items-baseline justify-between gap-3 text-2xl font-bold text-tinta">
        <dt>Total</dt>
        <dd>{soles(centimos(cuenta.total))}</dd>
      </div>
      {cuenta.totalPagado !== undefined && cuenta.saldoPendiente !== undefined && centimos(cuenta.totalPagado) > 0 && (
        <>
          {fila("Ya pagado", cuenta.totalPagado, "− ")}
          <div className="flex items-baseline justify-between gap-3 text-2xl font-bold text-tinta">
            <dt>Saldo</dt>
            <dd>{soles(centimos(cuenta.saldoPendiente))}</dd>
          </div>
        </>
      )}
    </dl>
  );
}
