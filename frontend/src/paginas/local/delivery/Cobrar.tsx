import { WarningIcon } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link } from "react-router";
import { Dialogo } from "../../../componentes/Dialogo";
import { api, mensajeDe } from "../../../lib/api";
import { claves, consultaCaja } from "../../../lib/consultas";
import type { Pedido } from "../../../lib/tipos";
import { saldoDe } from "../../../local/delivery";
import { soles } from "../../../local/dinero";
import { nuevoId } from "../../../mozo/uuid";
import { useConexion } from "../../../tiempo-real/contexto";
import { FormularioCobro, type PagoAEnviar } from "../caja/FormularioCobro";

// Sin caja abierta no se cobra: se dice, con el camino para abrirla
export function AvisoSinCaja() {
  return (
    <p role="alert" className="flex items-start gap-2.5 rounded-control bg-alerta-suave px-4 py-3 text-lg font-bold text-alerta-fuerte">
      <WarningIcon aria-hidden="true" weight="fill" className="mt-0.5 size-6 shrink-0" />
      <span>
        La caja está cerrada.{" "}
        <Link to="/local/caja" className="underline decoration-2 underline-offset-4">
          Ábrela en la pestaña Caja
        </Link>{" "}
        para poder cobrar.
      </span>
    </p>
  );
}

type Props = { pedido: Pedido | null; alCerrar: () => void };

// Confirmar el Yape que el cliente dijo haber hecho, o cobrar lo que trae el
// motorizado: el mismo cobro de Caja, con el método y el monto ya sugeridos.
export function Cobrar({ pedido, alCerrar }: Props) {
  const consultas = useQueryClient();
  const caja = useQuery(consultaCaja);
  const enLinea = useConexion() === "en-linea";
  const [error, setError] = useState<string | null>(null);
  // El mismo id en cada reintento de este cobro: nunca se registra dos veces
  const idCobro = useRef<string | null>(null);
  const [visible, setVisible] = useState(pedido);
  if (pedido && pedido !== visible) {
    setVisible(pedido);
    setError(null);
  }

  const previsto = visible?.pagoPrevisto ?? null;
  const confirmando = previsto?.momento === "ANTICIPADO";

  async function cobrar(pagos: PagoAEnviar[]) {
    if (!visible) return;
    setError(null);
    try {
      await api(`/pedidos/${visible.id}/pagos`, { metodo: "POST", cuerpo: { idCobro: (idCobro.current ??= nuevoId()), pagos } });
      idCobro.current = null;
      void consultas.invalidateQueries({ queryKey: claves.pedidos });
      void consultas.invalidateQueries({ queryKey: claves.caja });
      alCerrar();
    } catch (causa) {
      setError(mensajeDe(causa));
    }
  }

  return (
    <Dialogo abierto={pedido !== null} alCerrar={alCerrar} titulo={visible ? `${confirmando ? "Confirmar el pago" : "Cobrar"} del pedido #${visible.numero}` : ""}>
      {visible && (
        <div className="flex flex-col gap-4">
          <p className="flex items-baseline justify-between gap-3 text-tinta">
            <span className="text-2xl font-bold">{visible.cliente?.nombre ?? "Cliente"}</span>
            <span className="text-5xl leading-none font-bold tabular-nums">{soles(saldoDe(visible))}</span>
          </p>
          {confirmando && <p className="text-lg text-marino">Confírmalo solo cuando hayas visto el abono en tu celular.</p>}
          {caja.data === null && <AvisoSinCaja />}
          {error && (
            <p role="alert" className="rounded-control bg-peligro-suave px-4 py-3 text-lg font-bold text-peligro">
              {error}
            </p>
          )}
          {/* La clave arma el formulario de nuevo para cada pedido, con su pago previsto ya elegido */}
          <FormularioCobro
            key={visible.id}
            enDialogo
            objetivo={saldoDe(visible)}
            bloqueo={!enLinea ? "Sin conexión: no se puede cobrar" : caja.data === null ? "Abre la caja para cobrar" : null}
            inicial={previsto ? { metodo: previsto.metodo, recibido: previsto.pagaCon ? String(Number(previsto.pagaCon)) : "" } : undefined}
            alCobrar={cobrar}
          />
        </div>
      )}
    </Dialogo>
  );
}
