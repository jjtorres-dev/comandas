import { PlusIcon, ProhibitIcon, WarningIcon, XIcon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useRef, useState } from "react";
import { Boton } from "../../../componentes/Boton";
import { BotonConfirmar } from "../../../componentes/BotonConfirmar";
import { Campo } from "../../../componentes/Campo";
import { Dialogo } from "../../../componentes/Dialogo";
import { PildoraEstado } from "../../../componentes/PildoraEstado";
import { api, mensajeDe } from "../../../lib/api";
import { claves } from "../../../lib/consultas";
import { platosDeCombo } from "../../../lib/formato";
import type { Carta, Pedido } from "../../../lib/tipos";
import { centimos, soles } from "../../../local/dinero";
import { faltaEnPago, type PagoElegido, pagoDesde, pagoParaApi } from "../../../local/pagoPrevisto";
import { agregar, comoItems, type Linea } from "../../../mozo/lineas";
import { nuevoId } from "../../../mozo/uuid";
import { BuscadorDeCarta } from "./BuscadorDeCarta";
import { Lineas } from "./Lineas";
import { PagoPrevisto } from "./PagoPrevisto";

type Props = { pedido: Pedido | null; carta: Carta; alCerrar: () => void };

// El cliente volvió a llamar: agregar platos (entran como ronda nueva), cancelar
// los que cocina aún no empezó, corregir la entrega o el pago, o cancelar todo.
// El pedido que se muestra es el del servidor: total y tapers se recalculan allá.
export function Modificar({ pedido, carta, alCerrar }: Props) {
  // Mientras se cierra, el diálogo conserva el último pedido que mostró
  const [visible, setVisible] = useState(pedido);
  if (pedido && pedido !== visible) setVisible(pedido);

  return (
    <Dialogo abierto={pedido !== null} alCerrar={alCerrar} amplio titulo={visible ? `Modificar el pedido #${visible.numero} · ${visible.cliente?.nombre ?? "Cliente"}` : ""}>
      {/* La clave reinicia lo que se estaba escribiendo al abrir otro pedido */}
      {visible && <Contenido key={visible.id} pedido={visible} carta={carta} alCerrar={alCerrar} />}
    </Dialogo>
  );
}

const TITULO = "text-xl font-bold text-tinta";

function Contenido({ pedido, carta, alCerrar }: { pedido: Pedido; carta: Carta; alCerrar: () => void }) {
  const consultas = useQueryClient();
  const esDelivery = pedido.tipo === "DELIVERY";
  const refrescar = () => void consultas.invalidateQueries({ queryKey: claves.pedidos });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  // Cada acción avisa si falla y deja lo escrito como estaba
  async function hacer(nombre: string, accion: () => Promise<unknown>, alTerminar?: () => void) {
    setOcupado(nombre);
    setError(null);
    try {
      await accion();
      refrescar();
      alTerminar?.();
    } catch (causa) {
      setError(mensajeDe(causa));
    } finally {
      setOcupado(null);
    }
  }

  // ---------- Agregar platos ----------
  const [nuevas, setNuevas] = useState<Linea[]>([]);
  const idRonda = useRef<string | null>(null);
  const sumaNuevas = nuevas.reduce((s, l) => s + Math.round(l.precio * 100) * l.cantidad, 0);
  const agregarRonda = () =>
    hacer(
      "ronda",
      () => api(`/pedidos/${pedido.id}/items`, { metodo: "POST", cuerpo: { idRonda: (idRonda.current ??= nuevoId()), items: comoItems(nuevas) } }),
      () => {
        idRonda.current = null;
        setNuevas([]);
      },
    );

  // ---------- Entrega y pago ----------
  const [direccion, setDireccion] = useState(pedido.direccionEntrega ?? "");
  const [distrito, setDistrito] = useState(pedido.distritoEntrega ?? carta.reparto.distritos[0] ?? "");
  const [referencia, setReferencia] = useState(pedido.referenciaEntrega ?? "");
  const [pago, setPago] = useState<PagoElegido>(pagoDesde(pedido.pagoPrevisto));
  const idDistrito = useId();
  const total = centimos(pedido.saldoPendiente);
  const faltaPago = faltaEnPago(pago, total);
  const faltaEntrega = esDelivery && !direccion.trim() ? "Falta la dirección" : faltaPago;
  const guardarEntrega = () =>
    hacer("entrega", () =>
      api(`/pedidos/${pedido.id}/entrega`, {
        metodo: "PATCH",
        cuerpo: { ...(esDelivery ? { direccion: direccion.trim(), ...(distrito ? { distrito } : {}), referencia: referencia.trim() } : {}), pagoPrevisto: pagoParaApi(pago) },
      }),
    );

  // ---------- Cancelar el pedido ----------
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const idMotivo = useId();
  const conPago = centimos(pedido.totalPagado) > 0;
  const cancelarPedido = () => hacer("cancelar", () => api(`/pedidos/${pedido.id}/cancelar`, { metodo: "PATCH", cuerpo: { motivo: motivo.trim() } }), alCerrar);

  const vivos = pedido.items.filter((i) => i.estado !== "CANCELADO");

  return (
    <div className="flex flex-col gap-5">
      {error && (
        <p role="alert" className="flex items-start gap-2 rounded-control bg-peligro-suave px-4 py-3 text-lg font-bold text-peligro">
          <WarningIcon aria-hidden="true" weight="fill" className="mt-0.5 size-6 shrink-0" />
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-5">
          <section aria-label="Agregar platos" className="flex flex-col gap-3">
            <h3 className={TITULO}>Agregar platos</h3>
            <BuscadorCompacto carta={carta} alAgregar={(linea) => setNuevas((n) => agregar(n, linea))} />
            {nuevas.length > 0 && (
              <>
                <Lineas lineas={nuevas} alCambiar={setNuevas} notasRapidas={carta.notasRapidas} vacio="" />
                <Boton ocupado={ocupado === "ronda"} onClick={() => void agregarRonda()} icono={<PlusIcon aria-hidden="true" weight="bold" className="size-6" />}>
                  Agregar al pedido: {soles(sumaNuevas)}
                </Boton>
              </>
            )}
          </section>

          <section aria-label="Platos del pedido" className="flex flex-col gap-3">
            <h3 className={TITULO}>En el pedido</h3>
            <ul className="flex flex-col divide-y-2 divide-borde rounded-control border-2 border-borde-fuerte">
              {vivos.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2.5">
                  <div className="min-w-40 flex-1">
                    <p className="text-xl leading-tight font-bold text-tinta">
                      <span className="tabular-nums">{item.cantidad}×</span> {item.nombreProducto}
                    </p>
                    {item.componentes.length > 0 && <p className="text-lg leading-snug text-marino">{platosDeCombo(item.componentes)}</p>}
                    {item.notas.length > 0 && <p className="text-lg leading-snug font-bold text-marino">{item.notas.join(" · ")}</p>}
                  </div>
                  <PildoraEstado estado={item.estado} />
                  {/* Solo lo que cocina todavía no empezó */}
                  {item.estado === "PENDIENTE" && (
                    <BotonConfirmar
                      texto="Cancelar plato"
                      pregunta="Sí, cancelar"
                      ocupado={ocupado === item.id}
                      alConfirmar={() => void hacer(item.id, () => api(`/pedidos/${pedido.id}/items/${item.id}/cancelar`, { metodo: "PATCH" }))}
                      icono={<XIcon aria-hidden="true" weight="bold" className="size-5" />}
                    />
                  )}
                </li>
              ))}
            </ul>
            <dl className="flex flex-col gap-1 text-xl tabular-nums">
              <div className="flex justify-between gap-3">
                <dt>
                  Envío {soles(centimos(pedido.costoEnvio))} · tapers ({pedido.cantidadTapers}) {soles(centimos(pedido.cargoTapers))}
                </dt>
              </div>
              <div className="flex items-baseline justify-between gap-3 text-tinta">
                <dt className="text-2xl font-bold">Total</dt>
                <dd className="text-4xl font-bold">{soles(centimos(pedido.total))}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section aria-label="Entrega y pago" className="flex flex-col gap-4">
            <h3 className={TITULO}>{esDelivery ? "Entrega y pago" : "Pago"}</h3>
            {esDelivery && (
              <>
                <Campo etiqueta="Dirección" name="direccion" autoComplete="off" maxLength={200} value={direccion} onChange={(e) => setDireccion(e.target.value)} />
                {carta.reparto.distritos.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <label htmlFor={idDistrito} className="text-lg font-bold text-marino">
                      Distrito
                    </label>
                    <select
                      id={idDistrito}
                      value={distrito}
                      onChange={(e) => setDistrito(e.target.value)}
                      className="h-14 w-full rounded-control border-2 border-borde-fuerte bg-superficie px-4 text-xl text-tinta focus:border-marino"
                    >
                      {carta.reparto.distritos.map((d) => (
                        <option key={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                )}
                <Campo etiqueta="Referencia" name="referencia" autoComplete="off" maxLength={200} value={referencia} onChange={(e) => setReferencia(e.target.value)} />
              </>
            )}
            {pedido.pagado ? (
              <p className="text-lg font-bold text-marino">El pedido ya está pagado.</p>
            ) : (
              <PagoPrevisto valor={pago} alCambiar={setPago} total={total} delivery={esDelivery} />
            )}
            <Boton variante="secundario" ocupado={ocupado === "entrega"} disabled={faltaEntrega !== null && !pedido.pagado} onClick={() => void guardarEntrega()}>
              Guardar {esDelivery ? "entrega y pago" : "pago"}
            </Boton>
            {faltaEntrega && !pedido.pagado && <p className="text-center text-lg font-bold text-marino">{faltaEntrega}</p>}
          </section>

          <section aria-label="Cancelar pedido" className="flex flex-col gap-3 border-t-2 border-borde pt-4">
            {conPago ? (
              <p className="flex items-start gap-2 rounded-control bg-alerta-suave px-4 py-3 text-lg font-bold text-alerta-fuerte">
                <WarningIcon aria-hidden="true" weight="fill" className="mt-0.5 size-6 shrink-0" />
                Este pedido tiene un pago registrado. Para cancelarlo, primero anula ese pago en la pestaña Caja.
              </p>
            ) : cancelando ? (
              <>
                <label htmlFor={idMotivo} className="text-lg font-bold text-marino">
                  ¿Por qué se cancela el pedido? (obligatorio)
                </label>
                <textarea
                  id={idMotivo}
                  rows={2}
                  maxLength={200}
                  autoFocus
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej.: el cliente ya no lo quiere"
                  className="w-full rounded-control border-2 border-borde-fuerte bg-superficie px-4 py-3 text-xl text-tinta placeholder:text-texto-suave focus:border-marino"
                />
                <div className="flex flex-col gap-3 sm:flex-row-reverse">
                  <button
                    type="button"
                    disabled={motivo.trim().length < 3 || ocupado === "cancelar"}
                    onClick={() => void cancelarPedido()}
                    className="presionable inline-flex min-h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-control bg-peligro px-5 text-xl font-bold whitespace-nowrap text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <ProhibitIcon aria-hidden="true" weight="bold" className="size-6" />
                    Cancelar el pedido #{pedido.numero}
                  </button>
                  <Boton variante="secundario" className="flex-1" onClick={() => setCancelando(false)}>
                    No cancelar
                  </Boton>
                </div>
              </>
            ) : (
              <Boton variante="peligro" onClick={() => setCancelando(true)} icono={<ProhibitIcon aria-hidden="true" weight="bold" className="size-6" />}>
                Cancelar pedido
              </Boton>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// Dentro del diálogo, el buscador no muestra la carta entera: solo resultados
function BuscadorCompacto({ carta, alAgregar }: { carta: Carta; alAgregar: (linea: Linea) => void }) {
  const campo = useRef<HTMLInputElement>(null);
  return <BuscadorDeCarta carta={carta} campo={campo} alAgregar={alAgregar} soloResultados />;
}
