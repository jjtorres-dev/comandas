import { CaretRightIcon, HandCoinsIcon } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Boton } from "../../../componentes/Boton";
import { Dialogo } from "../../../componentes/Dialogo";
import { api, mensajeDe } from "../../../lib/api";
import { claves, consultaCaja } from "../../../lib/consultas";
import { plural } from "../../../lib/formato";
import type { Pedido } from "../../../lib/tipos";
import { saldoDe } from "../../../local/delivery";
import { centimos, paraApi, soles } from "../../../local/dinero";
import { nuevoId } from "../../../mozo/uuid";
import { AvisoSinCaja } from "./Cobrar";

// Lo que el motorizado entregó en contraentrega efectivo y todavía no rindió.
// Una franja siempre a la vista arriba del tablero, y "Cobrar todo" de una vez.
export function Rendicion({ pedidos }: { pedidos: Pedido[] }) {
  const consultas = useQueryClient();
  const caja = useQuery(consultaCaja);
  const [abierto, setAbierto] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Un idCobro por pedido, el mismo si hay que reintentar: ninguno se cobra dos veces
  const ids = useRef(new Map<string, string>());

  const total = pedidos.reduce((s, p) => s + saldoDe(p), 0);
  if (pedidos.length === 0 && !abierto) return null;

  async function cobrarTodo() {
    setCobrando(true);
    setError(null);
    try {
      for (const pedido of pedidos) {
        const saldo = saldoDe(pedido);
        const pagaCon = pedido.pagoPrevisto?.pagaCon ? centimos(pedido.pagoPrevisto.pagaCon) : null;
        if (!ids.current.has(pedido.id)) ids.current.set(pedido.id, nuevoId());
        await api(`/pedidos/${pedido.id}/pagos`, {
          metodo: "POST",
          cuerpo: {
            idCobro: ids.current.get(pedido.id),
            pagos: [{ metodo: "EFECTIVO", monto: paraApi(saldo), ...(pagaCon !== null && pagaCon >= saldo ? { recibido: paraApi(pagaCon) } : {}) }],
          },
        });
      }
      setAbierto(false);
    } catch (causa) {
      // Lo ya cobrado queda cobrado; al reintentar sigue con lo que falta
      setError(mensajeDe(causa));
    } finally {
      setCobrando(false);
      void consultas.invalidateQueries({ queryKey: claves.pedidos });
      void consultas.invalidateQueries({ queryKey: claves.caja });
    }
  }

  return (
    <>
      {pedidos.length > 0 && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="presionable flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-control border-2 border-tinta bg-alerta-suave px-4 py-2 text-left text-xl font-bold text-tinta hover:bg-alerta"
        >
          <HandCoinsIcon aria-hidden="true" weight="bold" className="size-7 shrink-0" />
          <span className="flex-1 tabular-nums">
            Motorizado debe rendir {soles(total)} ({plural(pedidos.length, "pedido", "pedidos")})
          </span>
          <span className="inline-flex items-center gap-1 underline decoration-2 underline-offset-4">
            Ver y cobrar
            <CaretRightIcon aria-hidden="true" weight="bold" className="size-5" />
          </span>
        </button>
      )}

      <Dialogo
        abierto={abierto}
        alCerrar={() => setAbierto(false)}
        titulo="Rendición del motorizado"
        pie={
          <Boton ocupado={cobrando} disabled={pedidos.length === 0 || caja.data === null} onClick={() => void cobrarTodo()}>
            Cobrar todo: {soles(total)}
          </Boton>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="text-lg text-marino">Entregados en efectivo que todavía no entraron a la caja. Cada uno se registra como un cobro aparte.</p>
          <ul className="flex flex-col divide-y-2 divide-borde rounded-control border-2 border-borde-fuerte">
            {pedidos.map((pedido) => (
              <li key={pedido.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-xl font-bold text-tinta">
                    <span className="tabular-nums">#{pedido.numero}</span> · {pedido.cliente?.nombre ?? "Cliente"}
                  </p>
                  <p className="text-lg text-marino">
                    {pedido.repartidor?.nombre ?? "Sin motorizado"}
                    {pedido.pagoPrevisto?.pagaCon ? ` · pagó con ${soles(centimos(pedido.pagoPrevisto.pagaCon))}` : ""}
                  </p>
                </div>
                <p className="text-2xl font-bold text-tinta tabular-nums">{soles(saldoDe(pedido))}</p>
              </li>
            ))}
          </ul>
          {caja.data === null && <AvisoSinCaja />}
          {error && (
            <p role="alert" className="rounded-control bg-peligro-suave px-4 py-3 text-lg font-bold text-peligro">
              No se pudo cobrar todo: {error}
            </p>
          )}
        </div>
      </Dialogo>
    </>
  );
}
