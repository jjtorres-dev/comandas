import { ArrowLeftIcon, ArrowsClockwiseIcon, CheckCircleIcon, PaperPlaneRightIcon, UserPlusIcon, WarningIcon } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { Campo } from "../../../componentes/Campo";
import { api, mensajeDe } from "../../../lib/api";
import { claves } from "../../../lib/consultas";
import { haceCuanto, plural, useAhora } from "../../../lib/formato";
import type { Carta, ClienteGuardado, Pedido, TipoPedido } from "../../../lib/tipos";
import { celular } from "../../../local/delivery";
import { centimos, leerMonto, paraApi, soles } from "../../../local/dinero";
import { faltaEnPago, PAGO_VACIO, type PagoElegido, pagoParaApi } from "../../../local/pagoPrevisto";
import { agregar, comoItems, type Linea, lineaDe, unir } from "../../../mozo/lineas";
import { nuevoId } from "../../../mozo/uuid";
import { useConexion } from "../../../tiempo-real/contexto";
import { BuscadorDeCarta } from "./BuscadorDeCarta";
import { Lineas } from "./Lineas";
import { PagoPrevisto } from "./PagoPrevisto";

// `distinto`: el servidor devolvió un pedido que no coincide con lo que hay en
// pantalla (un envío anterior sí había llegado y después se cambió algo)
type Props = { carta: Carta; alTerminar: (enviado: Pedido | null, distinto?: boolean) => void };

const PANEL = "flex flex-col gap-4 rounded-panel border-2 border-borde-fuerte bg-superficie p-4";
const SEGMENTO = "presionable min-h-12 cursor-pointer rounded-interior px-3 text-xl font-bold";
const ATAJO = "presionable min-h-12 min-w-14 cursor-pointer rounded-control border-2 px-3 text-xl font-bold tabular-nums";

// Los platos de un pedido anterior, convertidos en líneas con lo que la carta
// ofrece hoy. Lo que ya no existe se devuelve aparte, para avisarlo.
function repetir(pedido: Pedido, carta: Carta): { lineas: Linea[]; faltan: string[] } {
  const productos = carta.categorias.flatMap((c) => c.productos);
  const lineas: Linea[] = [];
  const faltan: string[] = [];
  for (const item of pedido.items) {
    if (item.estado === "CANCELADO") continue;
    const producto = productos.find((p) => p.variantes.some((v) => v.id === item.varianteId));
    const variante = producto?.variantes.find((v) => v.id === item.varianteId);
    // Los platos de un combo se guardaron por nombre: se buscan entre las opciones de hoy
    const componentes = item.componentes.map((nombre) => producto?.opcionesCombo.find((o) => o.nombre === nombre));
    if (!producto || !variante || componentes.some((c) => !c)) {
      faltan.push(item.nombreProducto);
      continue;
    }
    lineas.push({ ...lineaDe(producto, variante, componentes as NonNullable<(typeof componentes)[number]>[]), cantidad: item.cantidad, notas: item.notas });
  }
  return { lineas: unir(lineas), faltan };
}

// Tomar un pedido por teléfono, de corrido y con el teclado: teléfono, platos,
// envío, pago previsto y Ctrl+Enter.
export function NuevoPedido({ carta, alTerminar }: Props) {
  const consultas = useQueryClient();
  const enLinea = useConexion() === "en-linea";
  const ahora = useAhora();
  const { reparto } = carta;
  const [tipo, setTipo] = useState<TipoPedido>("DELIVERY");
  const [telefono, setTelefono] = useState("");
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [distrito, setDistrito] = useState(reparto.distritos[0] ?? "");
  const [referencia, setReferencia] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [envio, setEnvio] = useState(String(Number(reparto.costoEnvioDefault)));
  const [envioOtro, setEnvioOtro] = useState(false);
  const [pago, setPago] = useState<PagoElegido>(PAGO_VACIO);
  const [faltanDeRepetir, setFaltanDeRepetir] = useState<string[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saliendo, setSaliendo] = useState(false);
  const buscador = useRef<HTMLInputElement>(null);
  // El mismo id en cada reintento: si la respuesta se pierde, el pedido no se duplica
  const idCliente = useRef<string | null>(null);
  const idDistrito = useId();

  const esDelivery = tipo === "DELIVERY";
  const numero = celular(telefono);

  // Con el teléfono completo se busca al cliente y su último pedido
  const cliente = useQuery({
    queryKey: ["cliente", numero],
    queryFn: async ({ signal }) => (await api<{ cliente: ClienteGuardado | null }>(`/clientes/buscar?telefono=${numero}`, { signal })).cliente,
    enabled: numero !== null,
    staleTime: 0,
  });
  const ultimo = useQuery({
    queryKey: [...claves.pedidos, "ultimo-de", numero],
    queryFn: async ({ signal }) => (await api<{ pedido: Pedido | null }>(`/clientes/ultimo-pedido?telefono=${numero}`, { signal })).pedido,
    enabled: numero !== null && cliente.data != null,
  });

  // Al encontrar al cliente se rellenan sus datos, una vez por teléfono (se pueden
  // corregir). Si después se cambia el teléfono, lo que se había rellenado solo
  // se borra: la dirección de un cliente no puede quedarse en el pedido de otro.
  const [rellenado, setRellenado] = useState<string | null>(null);
  if (cliente.data && numero && rellenado !== numero) {
    setRellenado(numero);
    setNombre(cliente.data.nombre ?? "");
    setDireccion(cliente.data.direccion ?? "");
    setReferencia(cliente.data.referencia ?? "");
    setDistrito(cliente.data.distrito && reparto.distritos.includes(cliente.data.distrito) ? cliente.data.distrito : (reparto.distritos[0] ?? ""));
  } else if (rellenado !== null && numero !== rellenado && (numero === null || cliente.isSuccess)) {
    setRellenado(null);
    setNombre("");
    setDireccion("");
    setReferencia("");
    setDistrito(reparto.distritos[0] ?? "");
    setFaltanDeRepetir([]);
  }

  // ---------- Cuentas para decirle el total al cliente (el confirmado llega al enviar) ----------
  const productos = carta.categorias.flatMap((c) => c.productos);
  const subtotal = lineas.reduce((s, l) => s + Math.round(l.precio * 100) * l.cantidad, 0);
  const tapers = lineas.reduce((s, l) => s + l.cantidad * (productos.find((p) => p.id === l.productoId)?.tapers ?? 0), 0);
  const cargoTapers = tapers * centimos(reparto.precioTaper);
  const cEnvio = esDelivery ? leerMonto(envio || "0") : 0;
  const total = subtotal + cargoTapers + (cEnvio ?? 0);

  let falta: string | null = null;
  if (!enLinea) falta = "Sin conexión: no se puede enviar";
  else if (!numero) falta = "Escribe el celular del cliente (9 dígitos)";
  else if (esDelivery && !direccion.trim()) falta = "Falta la dirección";
  else if (lineas.length === 0) falta = "Agrega al menos un plato";
  else if (cEnvio === null || cEnvio > 2000) falta = "Revisa el costo de envío (de 0 a 20)";
  else falta = faltaEnPago(pago, total);

  async function enviar() {
    if (falta || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      const { pedido } = await api<{ pedido: Pedido }>("/pedidos", {
        metodo: "POST",
        cuerpo: {
          tipo,
          idCliente: (idCliente.current ??= nuevoId()),
          items: comoItems(lineas),
          cliente: {
            telefono: numero,
            ...(nombre.trim() ? { nombre: nombre.trim() } : {}),
            ...(esDelivery ? { direccion: direccion.trim(), ...(distrito ? { distrito } : {}), ...(referencia.trim() ? { referencia: referencia.trim() } : {}) } : {}),
          },
          ...(esDelivery ? { costoEnvio: paraApi(cEnvio!) } : {}),
          pagoPrevisto: pagoParaApi(pago),
        },
      });
      void consultas.invalidateQueries({ queryKey: claves.pedidos });
      alTerminar(pedido, centimos(pedido.total) !== total);
    } catch (causa) {
      setError(mensajeDe(causa));
      setEnviando(false);
    }
  }

  // Ctrl+Enter envía desde cualquier campo; Esc vuelve al tablero (preguntando si hay algo anotado)
  const teclas = useRef({ enviar, salir: () => {} });
  useEffect(() => {
    teclas.current = { enviar, salir: () => (lineas.length > 0 || telefono.trim() ? setSaliendo(true) : alTerminar(null)) };
  });
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (document.querySelector("dialog[open]")) return;
      if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) {
        evento.preventDefault();
        void teclas.current.enviar();
      } else if (evento.key === "Escape") {
        evento.preventDefault();
        teclas.current.salir();
      }
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  const campoTexto = "h-14 w-full rounded-control border-2 border-borde-fuerte bg-superficie px-4 text-xl text-tinta focus:border-marino";

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => teclas.current.salir()}
          className="presionable inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-control border-2 border-marino bg-superficie px-4 text-xl font-bold text-marino hover:bg-primario-suave"
        >
          <ArrowLeftIcon aria-hidden="true" weight="bold" className="size-6" />
          Pedidos de hoy
        </button>
        <h1 className="text-3xl font-bold text-tinta">Nuevo pedido</h1>
        {saliendo && (
          <p role="alert" className="flex flex-wrap items-center gap-3 rounded-control bg-alerta px-4 py-2 text-lg font-bold text-tinta">
            ¿Descartar lo anotado?
            <button type="button" onClick={() => alTerminar(null)} className="min-h-12 cursor-pointer rounded-control bg-superficie px-4 underline decoration-2 underline-offset-4">
              Sí, descartar
            </button>
            <button type="button" onClick={() => setSaliendo(false)} className="min-h-12 cursor-pointer px-2 underline decoration-2 underline-offset-4">
              Seguir anotando
            </button>
          </p>
        )}
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[24rem_minmax(0,1fr)_28rem]">
        {/* ---------- 1. Cliente ---------- */}
        <section aria-label="Cliente" className={PANEL}>
          <h2 className="text-2xl font-bold text-tinta">1. Cliente</h2>
          <div role="group" aria-label="Tipo de pedido" className="grid grid-cols-2 gap-1 rounded-control border-2 border-borde-fuerte p-1">
            {(
              [
                ["DELIVERY", "Delivery"],
                ["PARA_LLEVAR", "Para llevar"],
              ] as const
            ).map(([id, texto]) => (
              <button key={id} type="button" aria-pressed={tipo === id} onClick={() => setTipo(id)} className={`${SEGMENTO} ${tipo === id ? "bg-primario text-tinta" : "text-marino hover:bg-primario-suave"}`}>
                {texto}
              </button>
            ))}
          </div>

          <Campo
            etiqueta="Celular"
            name="telefono"
            inputMode="tel"
            autoComplete="off"
            autoFocus
            placeholder="987 654 321"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
            error={telefono.replace(/\D/g, "").length >= 9 && !numero ? "Un celular tiene 9 dígitos y empieza con 9" : null}
          />

          {numero && cliente.isSuccess && (
            <p role="status" className={`flex items-center gap-2 rounded-control px-3 py-2 text-lg font-bold ${cliente.data ? "bg-listo-suave text-tinta" : "bg-fondo text-marino"}`}>
              {cliente.data ? (
                <CheckCircleIcon aria-hidden="true" weight="fill" className="size-6 shrink-0 text-listo-fuerte" />
              ) : (
                <UserPlusIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
              )}
              {cliente.data ? "Cliente conocido: revisa sus datos" : "Cliente nuevo"}
            </p>
          )}

          <Campo etiqueta="Nombre" name="nombre" autoComplete="off" autoCapitalize="words" maxLength={100} value={nombre} onChange={(e) => setNombre(e.target.value)} />

          {esDelivery && (
            <>
              <Campo etiqueta="Dirección" name="direccion" autoComplete="off" maxLength={200} value={direccion} onChange={(e) => setDireccion(e.target.value)} />
              {reparto.distritos.length > 0 && (
                <div className="flex flex-col gap-2">
                  <label htmlFor={idDistrito} className="text-lg font-bold text-marino">
                    Distrito
                  </label>
                  <select id={idDistrito} value={distrito} onChange={(e) => setDistrito(e.target.value)} className={campoTexto}>
                    {reparto.distritos.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}
              <Campo
                etiqueta="Referencia"
                ayuda="Opcional. Ej.: portón verde, frente al parque."
                name="referencia"
                autoComplete="off"
                maxLength={200}
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
              />
            </>
          )}

          {ultimo.data && (
            <section aria-label="Último pedido" className="flex flex-col gap-2 rounded-control border-2 border-borde bg-fondo p-3">
              <h3 className="text-lg font-bold text-tinta">
                Su último pedido <span className="font-normal text-marino">· {haceCuanto(ultimo.data.creadoEn, ahora)}</span>
              </h3>
              <ul className="text-lg leading-snug text-marino">
                {ultimo.data.items
                  .filter((i) => i.estado !== "CANCELADO")
                  .map((i) => (
                    <li key={i.id}>
                      <span className="font-bold tabular-nums">{i.cantidad}×</span> {i.nombreProducto}
                      {i.notas.length > 0 ? ` (${i.notas.join(", ")})` : ""}
                    </li>
                  ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  const { lineas: repetidas, faltan } = repetir(ultimo.data!, carta);
                  setLineas((actuales) => unir([...actuales, ...repetidas]));
                  setFaltanDeRepetir(faltan);
                  buscador.current?.focus();
                }}
                className="presionable inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-control bg-primario px-4 text-xl font-bold text-tinta hover:bg-primario-presionado"
              >
                <ArrowsClockwiseIcon aria-hidden="true" weight="bold" className="size-6" />
                Repetir pedido
              </button>
            </section>
          )}
        </section>

        {/* ---------- 2. Pedido ---------- */}
        <section aria-label="Carta" className={PANEL}>
          <h2 className="text-2xl font-bold text-tinta">2. ¿Qué pide?</h2>
          <BuscadorDeCarta carta={carta} campo={buscador} alAgregar={(linea) => setLineas((actuales) => agregar(actuales, linea))} />
        </section>

        {/* ---------- 3. Resumen ---------- */}
        <section aria-label="Resumen" className={PANEL}>
          <h2 className="text-2xl font-bold text-tinta">3. Resumen</h2>
          {faltanDeRepetir.length > 0 && (
            <p role="alert" className="flex items-start gap-2 rounded-control bg-alerta-suave px-3 py-2 text-lg font-bold text-alerta-fuerte">
              <WarningIcon aria-hidden="true" weight="fill" className="mt-0.5 size-6 shrink-0" />
              Ya no está en la carta: {faltanDeRepetir.join(", ")}
            </p>
          )}
          <Lineas lineas={lineas} alCambiar={setLineas} notasRapidas={carta.notasRapidas} vacio="Todavía no hay platos. Búscalos en la carta." />

          {esDelivery && (
            <fieldset>
              <legend className="mb-2 text-xl font-bold text-tinta">Envío</legend>
              <div className="flex flex-wrap items-center gap-2">
                {["0", "3", "5"].map((monto) => {
                  const elegido = !envioOtro && envio === monto;
                  return (
                    <button
                      key={monto}
                      type="button"
                      aria-pressed={elegido}
                      onClick={() => {
                        setEnvio(monto);
                        setEnvioOtro(false);
                      }}
                      className={`${ATAJO} ${elegido ? "border-tinta bg-primario text-tinta" : "border-borde-fuerte bg-superficie text-marino hover:bg-primario-suave"}`}
                    >
                      S/ {monto}
                    </button>
                  );
                })}
                <button
                  type="button"
                  aria-pressed={envioOtro}
                  onClick={() => setEnvioOtro(true)}
                  className={`${ATAJO} ${envioOtro ? "border-tinta bg-primario text-tinta" : "border-borde-fuerte bg-superficie text-marino hover:bg-primario-suave"}`}
                >
                  Otro
                </button>
                {envioOtro && (
                  <input
                    aria-label="Costo de envío en soles"
                    inputMode="decimal"
                    autoComplete="off"
                    autoFocus
                    value={envio}
                    onChange={(e) => setEnvio(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="h-12 w-24 rounded-control border-2 border-borde-fuerte bg-superficie px-3 text-right text-xl font-bold text-tinta tabular-nums focus:border-marino"
                  />
                )}
              </div>
            </fieldset>
          )}

          <dl className="flex flex-col gap-1 border-t-2 border-borde pt-3 text-xl tabular-nums">
            <div className="flex justify-between gap-3">
              <dt>Platos</dt>
              <dd>{soles(subtotal)}</dd>
            </div>
            {esDelivery && (
              <div className="flex justify-between gap-3">
                <dt>Envío</dt>
                <dd>{soles(cEnvio ?? 0)}</dd>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <dt>{plural(tapers, "taper", "tapers")} (se calculan solos)</dt>
              <dd>{soles(cargoTapers)}</dd>
            </div>
            {/* Lo que se le dice al cliente por teléfono */}
            <div className="flex items-baseline justify-between gap-3 text-tinta">
              <dt className="text-2xl font-bold">Total</dt>
              <dd className="text-5xl leading-none font-bold">{soles(total)}</dd>
            </div>
          </dl>

          <PagoPrevisto valor={pago} alCambiar={setPago} total={total} delivery={esDelivery} />

          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-control bg-peligro-suave px-3 py-2 text-lg font-bold text-peligro">
              <WarningIcon aria-hidden="true" weight="fill" className="mt-0.5 size-6 shrink-0" />
              {error}
            </p>
          )}
          {/* Enviar queda siempre a la vista, aunque el pedido tenga muchos platos */}
          <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-col gap-2 rounded-b-panel bg-superficie px-4 pt-2 pb-4">
          <button
              type="button"
              disabled={falta !== null || enviando}
              aria-busy={enviando || undefined}
              onClick={() => void enviar()}
              className="presionable inline-flex min-h-18 cursor-pointer items-center justify-center gap-3 rounded-control bg-primario px-4 text-2xl font-bold text-tinta hover:bg-primario-presionado disabled:cursor-not-allowed disabled:border-2 disabled:border-borde-fuerte disabled:bg-fondo disabled:text-marino"
            >
              <PaperPlaneRightIcon aria-hidden="true" weight="fill" className="size-7 shrink-0" />
              Enviar a cocina
            </button>
            <p aria-live="polite" className="min-h-7 text-center text-lg font-bold text-marino">
              {falta ?? "Ctrl + Enter para enviar"}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
