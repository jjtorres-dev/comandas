import { ArrowsLeftRightIcon, CheckIcon, ProhibitIcon, ReceiptIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Boton } from "../../../componentes/Boton";
import { Dialogo } from "../../../componentes/Dialogo";
import { ErrorDeCarga, Esqueleto } from "../../../componentes/EstadoDeCarga";
import { api, mensajeDe } from "../../../lib/api";
import { claves, clienteDeConsultas, consultaCobrados } from "../../../lib/consultas";
import { horaDe } from "../../../lib/formato";
import type { Cobrado, MetodoPago, PagoRegistrado } from "../../../lib/tipos";
import { centimos, leerMonto, METODOS, nombreDeMetodo, paraApi, soles } from "../../../local/dinero";
import { TIPOS } from "../../../local/tiposDePedido";
import { NotaDeVenta } from "./NotaDeVenta";

const nombreDe = (c: Cobrado["pedido"]) =>
  c.tipo === "MESA" ? (c.mesa?.nombre ?? "Mesa") : `${c.tipo === "DELIVERY" ? "Delivery" : "Para llevar"}${c.cliente?.nombre ? ` · ${c.cliente.nombre}` : ""}`;

const refrescar = () => {
  void clienteDeConsultas.invalidateQueries({ queryKey: claves.caja });
  void clienteDeConsultas.invalidateQueries({ queryKey: claves.pedidos });
  void clienteDeConsultas.invalidateQueries({ queryKey: claves.mesas });
};

const ACCION =
  "presionable inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-control border-2 px-3 text-lg font-bold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60";

type Corrigiendo = { tipo: "metodo" | "anular"; pedido: Cobrado["pedido"]; pago: PagoRegistrado };

// Los pedidos cobrados en el turno abierto, del más reciente al más antiguo.
// Desde aquí se reenvía una nota de venta y se corrige un pago antes de cerrar la caja.
export function Cobrados() {
  const cobrados = useQuery(consultaCobrados);
  const [corrigiendo, setCorrigiendo] = useState<Corrigiendo | null>(null);
  const [conNota, setConNota] = useState<string | null>(null);

  if (!cobrados.data) {
    return cobrados.isError ? <ErrorDeCarga error={cobrados.error} alReintentar={() => void cobrados.refetch()} /> : <Esqueleto className="h-64" />;
  }

  if (cobrados.data.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-panel border-2 border-dashed border-borde-fuerte px-6 py-10 text-center">
        <ReceiptIcon aria-hidden="true" weight="duotone" className="size-16 text-primario-fuerte" />
        <p className="text-2xl font-bold text-tinta">Todavía no se cobró nada en este turno</p>
      </div>
    );
  }

  return (
    <>
      <ul aria-label="Cobrados de este turno" className="mx-auto flex w-full max-w-5xl flex-col gap-4">
        {cobrados.data.map(({ pedido, pagos, ultimoPagoEn }) => {
          const tipo = TIPOS[pedido.tipo];
          return (
            <li key={pedido.id}>
              <article aria-label={`Pedido ${pedido.numero}, ${nombreDe(pedido)}`} className="overflow-hidden rounded-panel border-2 border-borde-fuerte bg-superficie">
                <header className={`flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-tinta ${tipo.clases}`}>
                  <tipo.icono aria-hidden="true" weight="bold" className="size-8 shrink-0" />
                  <h2 className="min-w-40 flex-1 text-2xl leading-tight font-bold">
                    <span className="tabular-nums">#{pedido.numero}</span> · {nombreDe(pedido)}
                  </h2>
                  <p className="text-xl tabular-nums">{horaDe(ultimoPagoEn)}</p>
                  <p className="text-2xl font-bold tabular-nums">{soles(centimos(pedido.total))}</p>
                </header>

                <div className="flex flex-col gap-3 p-4">
                  {!pedido.pagado && (
                    <p className="text-xl font-bold text-peligro tabular-nums">Falta cobrar {soles(centimos(pedido.saldoPendiente))}: está en "Por cobrar"</p>
                  )}
                  <ul className="flex flex-col divide-y-2 divide-borde">
                    {pagos.map((pago) => (
                      <li key={pago.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
                        <div className={`min-w-0 flex-1 ${pago.anulado ? "text-texto-suave" : "text-tinta"}`}>
                          <p className={`text-xl font-bold tabular-nums ${pago.anulado ? "line-through" : ""}`}>
                            {nombreDeMetodo(pago.metodo)} {soles(centimos(pago.monto))}
                            {pago.recibido && centimos(pago.vuelto) > 0 && (
                              <span className="font-normal"> · recibido {soles(centimos(pago.recibido))}, vuelto {soles(centimos(pago.vuelto))}</span>
                            )}
                            {pago.referencia && <span className="font-normal"> · op. {pago.referencia}</span>}
                          </p>
                          {pago.anulado && (
                            <p className="flex items-center gap-1.5 text-lg font-bold text-peligro">
                              <ProhibitIcon aria-hidden="true" weight="bold" className="size-5 shrink-0" />
                              Anulado{pago.anuladoPor ? ` por ${pago.anuladoPor.nombre}` : ""}: {pago.motivoAnulacion}
                            </p>
                          )}
                        </div>
                        {!pago.anulado && (
                          <div className="flex flex-wrap gap-2">
                            <button type="button" onClick={() => setCorrigiendo({ tipo: "metodo", pedido, pago })} className={`${ACCION} border-marino text-marino hover:bg-primario-suave`}>
                              <ArrowsLeftRightIcon aria-hidden="true" weight="bold" className="size-5" />
                              Cambiar método
                            </button>
                            <button type="button" onClick={() => setCorrigiendo({ tipo: "anular", pedido, pago })} className={`${ACCION} border-peligro text-peligro hover:bg-peligro-suave`}>
                              <ProhibitIcon aria-hidden="true" weight="bold" className="size-5" />
                              Anular pago
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  {conNota === pedido.id ? (
                    <NotaDeVenta pedidoId={pedido.id} />
                  ) : (
                    <button type="button" onClick={() => setConNota(pedido.id)} className={`${ACCION} self-start border-marino text-marino hover:bg-primario-suave`}>
                      <ReceiptIcon aria-hidden="true" weight="bold" className="size-5" />
                      Nota de venta
                    </button>
                  )}
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      <CambiarMetodo corrigiendo={corrigiendo?.tipo === "metodo" ? corrigiendo : null} alCerrar={() => setCorrigiendo(null)} />
      <AnularPago corrigiendo={corrigiendo?.tipo === "anular" ? corrigiendo : null} alCerrar={() => setCorrigiendo(null)} />
    </>
  );
}

// Lo último que se estaba corrigiendo: el diálogo conserva su contenido mientras se cierra
function useUltimaCorreccion(corrigiendo: Corrigiendo | null) {
  const [ultima, setUltima] = useState(corrigiendo);
  if (corrigiendo && corrigiendo !== ultima) setUltima(corrigiendo);
  return corrigiendo ?? ultima;
}

function CambiarMetodo({ corrigiendo, alCerrar }: { corrigiendo: Corrigiendo | null; alCerrar: () => void }) {
  const visible = useUltimaCorreccion(corrigiendo);
  const [metodo, setMetodo] = useState<MetodoPago | null>(null);
  const [recibido, setRecibido] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previo, setPrevio] = useState(corrigiendo);
  if (corrigiendo !== previo) {
    setPrevio(corrigiendo);
    if (corrigiendo) {
      setMetodo(null);
      setRecibido("");
      setError(null);
    }
  }

  const monto = visible ? centimos(visible.pago.monto) : 0;
  const cRecibido = recibido.trim() ? leerMonto(recibido) : monto;
  const recibidoMal = metodo === "EFECTIVO" && (cRecibido === null || cRecibido < monto);
  const valido = metodo !== null && metodo !== visible?.pago.metodo && !recibidoMal;

  async function guardar() {
    if (!visible || !valido) return;
    setGuardando(true);
    setError(null);
    try {
      await api(`/pedidos/${visible.pedido.id}/pagos/${visible.pago.id}/metodo`, {
        metodo: "PATCH",
        cuerpo: { metodo, ...(metodo === "EFECTIVO" && recibido.trim() ? { recibido: paraApi(cRecibido!) } : {}) },
      });
      refrescar();
      alCerrar();
    } catch (causa) {
      setError(mensajeDe(causa));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialogo
      abierto={corrigiendo !== null}
      alCerrar={alCerrar}
      titulo={`Cambiar el método del pedido #${visible?.pedido.numero ?? ""}`}
      pie={
        <Boton ocupado={guardando} disabled={!valido} onClick={() => void guardar()}>
          Guardar el cambio
        </Boton>
      }
    >
      {visible && (
        <div className="flex flex-col gap-4">
          <p className="text-xl text-marino">
            Está registrado como <strong className="text-tinta">{nombreDeMetodo(visible.pago.metodo)}</strong> por{" "}
            <strong className="text-tinta tabular-nums">{soles(monto)}</strong>. El monto no cambia.
          </p>
          <div role="group" aria-label="Método correcto" className="grid grid-cols-2 gap-2.5">
            {METODOS.filter((m) => m.id !== visible.pago.metodo).map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={metodo === m.id}
                onClick={() => setMetodo(m.id)}
                className={`presionable flex min-h-16 cursor-pointer items-center justify-center gap-2 rounded-control border-2 px-3 text-2xl font-bold ${
                  metodo === m.id ? "border-tinta bg-primario text-tinta" : "border-borde-fuerte bg-superficie text-marino hover:bg-primario-suave"
                }`}
              >
                {metodo === m.id && <CheckIcon aria-hidden="true" weight="bold" className="size-6" />}
                {m.nombre}
              </button>
            ))}
          </div>
          {metodo === "EFECTIVO" && (
            <div className="flex items-center gap-3">
              <label htmlFor="recibido-correccion" className="flex-1 text-xl font-bold text-tinta">
                Recibido (opcional)
              </label>
              <input
                id="recibido-correccion"
                inputMode="decimal"
                autoComplete="off"
                placeholder={(monto / 100).toFixed(2)}
                value={recibido}
                onChange={(e) => setRecibido(e.target.value)}
                className="h-14 w-40 rounded-control border-2 border-borde-fuerte bg-superficie px-3 text-right text-2xl font-bold text-tinta tabular-nums focus:border-marino"
              />
            </div>
          )}
          {recibidoMal && <p className="text-lg font-bold text-peligro">Lo recibido no puede ser menos que {soles(monto)}.</p>}
          {error && (
            <p role="alert" className="text-lg font-bold text-peligro">
              {error}
            </p>
          )}
        </div>
      )}
    </Dialogo>
  );
}

function AnularPago({ corrigiendo, alCerrar }: { corrigiendo: Corrigiendo | null; alCerrar: () => void }) {
  const visible = useUltimaCorreccion(corrigiendo);
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previo, setPrevio] = useState(corrigiendo);
  if (corrigiendo !== previo) {
    setPrevio(corrigiendo);
    if (corrigiendo) {
      setMotivo("");
      setError(null);
    }
  }

  const valido = motivo.trim().length >= 3;

  async function anular() {
    if (!visible || !valido) return;
    setGuardando(true);
    setError(null);
    try {
      await api(`/pedidos/${visible.pedido.id}/pagos/${visible.pago.id}/anular`, { metodo: "PATCH", cuerpo: { motivo: motivo.trim() } });
      refrescar();
      alCerrar();
    } catch (causa) {
      setError(mensajeDe(causa));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Dialogo
      abierto={corrigiendo !== null}
      alCerrar={alCerrar}
      titulo={`Anular un pago del pedido #${visible?.pedido.numero ?? ""}`}
      pie={
        <div className="flex flex-col gap-3 sm:flex-row-reverse">
          <button
            type="button"
            disabled={!valido || guardando}
            onClick={() => void anular()}
            className="presionable inline-flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-control bg-peligro px-5 text-xl font-bold whitespace-nowrap text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ProhibitIcon aria-hidden="true" weight="bold" className="size-6" />
            Anular {visible ? `${nombreDeMetodo(visible.pago.metodo)} ${soles(centimos(visible.pago.monto))}` : ""}
          </button>
          <Boton variante="secundario" className="flex-1" onClick={alCerrar}>
            No anular
          </Boton>
        </div>
      }
    >
      {visible && (
        <div className="flex flex-col gap-4">
          <p className="text-xl text-pretty text-marino">
            El pago no se borra: queda marcado como anulado y deja de contar en la caja. El pedido vuelve a "Por cobrar" con ese
            saldo pendiente.
          </p>
          <div className="flex flex-col gap-2">
            <label htmlFor="motivo-anulacion" className="text-lg font-bold text-marino">
              ¿Por qué se anula? (obligatorio)
            </label>
            <textarea
              id="motivo-anulacion"
              rows={2}
              maxLength={200}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej.: se cobró un monto equivocado"
              className="w-full rounded-control border-2 border-borde-fuerte bg-superficie px-4 py-3 text-xl text-tinta placeholder:text-texto-suave focus:border-marino"
            />
          </div>
          {error && (
            <p role="alert" className="text-lg font-bold text-peligro">
              {error}
            </p>
          )}
        </div>
      )}
    </Dialogo>
  );
}
