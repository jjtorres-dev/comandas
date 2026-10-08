import { CheckIcon } from "@phosphor-icons/react";
import { useId } from "react";
import type { MetodoPago } from "../../../lib/tipos";
import { leerMonto, nombreDeMetodo, soles } from "../../../local/dinero";
import type { PagoElegido } from "../../../local/pagoPrevisto";

const OPCION = "presionable flex min-h-14 cursor-pointer items-center justify-center gap-1.5 rounded-control border-2 px-2 text-center text-lg leading-tight font-bold sm:px-3 sm:text-xl";
const ELEGIDA = "border-tinta bg-primario text-tinta";
const LIBRE = "border-borde-fuerte bg-superficie text-marino hover:bg-primario-suave";
const ATAJO =
  "presionable min-h-12 cursor-pointer rounded-control border-2 border-marino bg-superficie px-1 text-lg font-bold text-marino tabular-nums hover:bg-primario-suave disabled:cursor-not-allowed disabled:border-borde disabled:text-texto-suave";

const sinPunto = (c: number) => (c / 100).toFixed(2).replace(/\.00$/, "");

type Props = { valor: PagoElegido; alCambiar: (pago: PagoElegido) => void; total: number; delivery: boolean };

// El pago previsto: lo que el motorizado necesita saber antes de salir. No
// registra ningún cobro; eso pasa al confirmar el Yape o al cobrar la entrega.
export function PagoPrevisto({ valor, alCambiar, total, delivery }: Props) {
  const idPagaCon = useId();
  const pagaCon = valor.pagaCon.trim() ? leerMonto(valor.pagaCon) : null;
  const metodos: MetodoPago[] = valor.momento === "ANTICIPADO" ? ["YAPE", "PLIN"] : ["EFECTIVO", "YAPE", "PLIN"];

  const boton = (elegida: boolean, texto: string, alTocar: () => void) => (
    <button key={texto} type="button" aria-pressed={elegida} onClick={alTocar} className={`${OPCION} ${elegida ? ELEGIDA : LIBRE}`}>
      {elegida && <CheckIcon aria-hidden="true" weight="bold" className="size-5 shrink-0" />}
      {texto}
    </button>
  );

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-2 text-xl font-bold text-tinta">¿Cómo va a pagar?</legend>
      <div className="grid grid-cols-2 gap-2">
        {boton(valor.momento === "ANTICIPADO", "Ya pagó", () => alCambiar({ momento: "ANTICIPADO", metodo: null, pagaCon: "" }))}
        {boton(valor.momento === "AL_RECIBIR", delivery ? "Paga al recibir" : "Paga al recoger", () => alCambiar({ momento: "AL_RECIBIR", metodo: null, pagaCon: "" }))}
      </div>

      {valor.momento && (
        <div role="group" aria-label={valor.momento === "ANTICIPADO" ? "¿Por dónde pagó?" : "¿Con qué paga?"} className={`grid gap-2 ${metodos.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
          {metodos.map((metodo) => boton(valor.metodo === metodo, nombreDeMetodo(metodo), () => alCambiar({ ...valor, metodo, pagaCon: metodo === "EFECTIVO" ? valor.pagaCon : "" })))}
        </div>
      )}

      {valor.momento === "ANTICIPADO" && valor.metodo && (
        <p className="text-lg text-marino">Queda "por confirmar": cuando veas el abono, confirma el pago en la tarjeta del pedido.</p>
      )}

      {valor.momento === "AL_RECIBIR" && valor.metodo === "EFECTIVO" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <label htmlFor={idPagaCon} className="flex-1 text-xl font-bold text-tinta">
              ¿Con cuánto paga?
            </label>
            <input
              id={idPagaCon}
              inputMode="decimal"
              autoComplete="off"
              placeholder={sinPunto(total)}
              value={valor.pagaCon}
              onChange={(e) => alCambiar({ ...valor, pagaCon: e.target.value })}
              onFocus={(e) => e.target.select()}
              className="h-14 w-36 rounded-control border-2 border-borde-fuerte bg-superficie px-3 text-right text-2xl font-bold text-tinta tabular-nums placeholder:text-texto-suave focus:border-marino"
            />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <button type="button" onClick={() => alCambiar({ ...valor, pagaCon: sinPunto(total) })} className={ATAJO}>
              Exacto
            </button>
            {[50, 100, 200].map((billete) => (
              <button key={billete} type="button" disabled={billete * 100 < total} onClick={() => alCambiar({ ...valor, pagaCon: String(billete) })} className={ATAJO}>
                S/ {billete}
              </button>
            ))}
          </div>
          {pagaCon !== null && pagaCon >= total && (
            <p aria-live="polite" className="rounded-control bg-listo-suave px-3 py-2 text-xl font-bold text-tinta tabular-nums">
              {delivery ? "El motorizado lleva" : "Hay que tener"} {soles(pagaCon - total)} de vuelto
            </p>
          )}
        </div>
      )}
    </fieldset>
  );
}
