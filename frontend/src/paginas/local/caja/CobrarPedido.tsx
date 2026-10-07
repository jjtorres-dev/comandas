import { ArrowLeftIcon, CheckCircleIcon, CheckIcon, MinusIcon, PlusIcon, SlidersHorizontalIcon, WarningIcon } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ErrorDeCarga, Esqueleto } from "../../../componentes/EstadoDeCarga";
import { api, mensajeDe } from "../../../lib/api";
import { claves, consultaCuenta } from "../../../lib/consultas";
import { platosDeCombo } from "../../../lib/formato";
import type { Cuenta, ItemDeCuenta, Pedido } from "../../../lib/tipos";
import { nombreDeTipo } from "../../../local/comandas";
import { centimos, partesIguales, soles } from "../../../local/dinero";
import { nuevoId } from "../../../mozo/uuid";
import { TIPOS } from "../../../local/tiposDePedido";
import { useConexion } from "../../../tiempo-real/contexto";
import { Ajustar } from "./Ajustar";
import { FormularioCobro, type PagoAEnviar } from "./FormularioCobro";
import { NotaDeVenta } from "./NotaDeVenta";

type Modo = "todo" | "platos" | "partes";

type Props = {
  pedido: Pedido;
  // Volver a la lista sin cobrar (Esc), y pasar al siguiente tras cobrar
  alSalir: () => void;
  alSiguiente: () => void;
};

type Cobrado = { monto: number; vuelto: number; pagado: boolean; saldo: number };

const MODOS: { id: Modo; nombre: string }[] = [
  { id: "todo", nombre: "Todo junto" },
  { id: "platos", nombre: "Por platos" },
  { id: "partes", nombre: "Partes iguales" },
];

const PANEL = "flex flex-col rounded-panel border-2 border-borde-fuerte bg-superficie";

// La cuenta de un pedido (centro) y su cobro (derecha). El caso normal, todo
// junto, no pide nada más que el método; dividir y ajustar están a un clic.
export function CobrarPedido({ pedido, alSalir, alSiguiente }: Props) {
  const consultas = useQueryClient();
  const cuenta = useQuery(consultaCuenta(pedido.id));
  const enLinea = useConexion() === "en-linea";
  const [modo, setModo] = useState<Modo>("todo");
  // Por platos: unidades marcadas de cada plato
  const [marcados, setMarcados] = useState<Record<string, number>>({});
  // Partes iguales: lo que toca a cada persona (céntimos) y cuántas ya pagaron
  const [personas, setPersonas] = useState(2);
  const [partes, setPartes] = useState<{ montos: number[]; hechas: number } | null>(null);
  const [cobrado, setCobrado] = useState<Cobrado | null>(null);
  const [ajustando, setAjustando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Para avisar si el pedido cambia mientras se está cobrando (ronda nueva, plato cancelado)
  const [totalVisto, setTotalVisto] = useState<string | null>(null);
  const botonSiguiente = useRef<HTMLButtonElement>(null);
  // Id del cobro en curso: el mismo en cada reintento, uno nuevo tras cobrar
  const idCobro = useRef<string | null>(null);
  // Cuándo apareció la pantalla del vuelto
  const cobradoEn = useRef(0);

  const datos = cuenta.data;
  if (datos && totalVisto === null) setTotalVisto(datos.total);
  const cambio = datos && totalVisto !== null && datos.total !== totalVisto && !cobrado;

  // Mientras llega la cuenta, el saldo del pedido ya alcanza para cobrar todo
  // junto: quien teclea rápido (flecha, E, Enter) no tiene que esperar
  const saldo = centimos(datos ? datos.saldoPendiente : pedido.saldoPendiente);
  const libres = (item: ItemDeCuenta) => item.cantidad - item.cantidadPagada;
  const quedanPlatos = datos?.items.some((i) => libres(i) > 0) ?? false;
  // Con todos los platos cobrados, lo que falta (envío, tapers) es "el resto de la cuenta"
  const modoReal: Modo = modo === "platos" && !quedanPlatos ? "todo" : modo;

  // Lo marcado se recorta a lo que hoy se puede cobrar: si entretanto se canceló
  // un plato o se pagó una unidad desde otro equipo, esa marca ya no cuenta
  const aCobrar = (datos?.items ?? [])
    .map((item) => ({ item, cantidad: Math.min(marcados[item.id] ?? 0, libres(item)) }))
    .filter((m) => m.cantidad > 0);
  const sumaMarcada = aCobrar.reduce((s, m) => s + centimos(m.item.precioUnitario) * m.cantidad, 0);

  // Partes iguales: el reparto se fija con el primer cobro. Si ya se cobraron
  // todas y aún queda saldo (el pedido creció), se reparte de nuevo.
  const enPartes = partes !== null && partes.hechas < partes.montos.length ? partes : null;
  const montosDePartes = enPartes?.montos ?? partesIguales(saldo, personas);
  const parteActual = enPartes?.hechas ?? 0;
  // Ninguna parte supera lo que falta, y la última se lleva exactamente el saldo
  const montoDeParte = parteActual === montosDePartes.length - 1 ? saldo : Math.min(montosDePartes[parteActual] ?? 0, saldo);
  const objetivo = modoReal === "todo" ? saldo : modoReal === "platos" ? sumaMarcada : montoDeParte;

  let bloqueo: string | null = null;
  if (!enLinea) bloqueo = "Sin conexión: no se puede cobrar";
  else if (modoReal === "platos" && sumaMarcada === 0) bloqueo = "Marca los platos que se cobran";
  else if (modoReal === "platos" && sumaMarcada > saldo) bloqueo = "El descuento no deja cobrar esos platos por separado: cobra todo junto";
  else if (objetivo <= 0) bloqueo = "No hay nada por cobrar";
  // Si el pedido cambió mientras se cobraba, primero hay que mirar el total nuevo
  else if (cambio) bloqueo = "El pedido cambió: revisa el total";

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo);
    setMarcados({});
    setPartes(null);
    setError(null);
  }

  async function cobrar(pagos: PagoAEnviar[]) {
    setError(null);
    const items = modoReal === "platos" ? aCobrar.map((m) => ({ itemId: m.item.id, cantidad: m.cantidad })) : undefined;
    try {
      const respuesta = await api<{ pedido: Pedido; vuelto: string; saldoPendiente: string }>(`/pedidos/${pedido.id}/pagos`, {
        metodo: "POST",
        // El mismo id en cada reintento de este cobro: si la respuesta se pierde, no se cobra dos veces
        cuerpo: { idCobro: (idCobro.current ??= nuevoId()), pagos, ...(items ? { items } : {}) },
      });
      idCobro.current = null;
      void consultas.invalidateQueries({ queryKey: claves.pedidos });
      void consultas.invalidateQueries({ queryKey: claves.mesas });
      void consultas.invalidateQueries({ queryKey: claves.caja });
      setMarcados({});
      // Las partes se fijan con el primer cobro: las siguientes ya no cambian aunque cambie el saldo
      if (modoReal === "partes") setPartes({ montos: montosDePartes, hechas: parteActual + 1 });
      setTotalVisto(respuesta.pedido.total);
      setCobrado({ monto: objetivo, vuelto: centimos(respuesta.vuelto), pagado: respuesta.pedido.pagado, saldo: centimos(respuesta.saldoPendiente) });
    } catch (causa) {
      setError(mensajeDe(causa));
    }
  }

  // Tras cobrar, Enter pasa al siguiente (o sigue con esta cuenta)
  useEffect(() => {
    if (!cobrado) return;
    cobradoEn.current = Date.now();
    botonSiguiente.current?.focus();
  }, [cobrado]);

  // Esc: un paso atrás
  const alEscapar = useRef(() => {});
  useEffect(() => {
    alEscapar.current = () => {
      // La pantalla del vuelto no se cierra con Esc: se sale de ella a propósito
      if (cobrado) return;
      // Con partes iguales a medio cobrar, Esc no deshace el reparto
      if (enPartes !== null && enPartes.hechas > 0) return;
      if (modo !== "todo") return cambiarModo("todo");
      alSalir();
    };
  });
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key !== "Escape" || document.querySelector("dialog[open]")) return;
      evento.preventDefault();
      alEscapar.current();
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  const tipo = TIPOS[pedido.tipo];

  return (
    <>
      {/* ---------- Cuenta ---------- */}
      <section aria-label="Cuenta" className={`${PANEL} overflow-hidden`}>
        <header className={`flex items-center gap-3 px-4 py-2.5 text-tinta ${tipo.clases}`}>
          <button
            type="button"
            onClick={alSalir}
            aria-label="Volver a la lista"
            className="presionable grid size-12 shrink-0 cursor-pointer place-items-center rounded-control hover:bg-primario-suave lg:hidden"
          >
            <ArrowLeftIcon aria-hidden="true" weight="bold" className="size-7" />
          </button>
          <tipo.icono aria-hidden="true" weight="bold" className="size-8 shrink-0" />
          <h2 className="min-w-0 flex-1 text-2xl leading-tight font-bold wrap-anywhere">
            {nombreDeTipo(pedido)} <span className="tabular-nums">· Pedido #{pedido.numero}</span>
          </h2>
        </header>

        {!datos ? (
          <div className="p-4">
            {cuenta.isError ? <ErrorDeCarga error={cuenta.error} alReintentar={() => void cuenta.refetch()} /> : <Esqueleto className="h-64" />}
          </div>
        ) : (
          <div className="flex flex-col gap-4 p-4">
            {cambio && (
              <p role="alert" className="flex items-center gap-2.5 rounded-control bg-alerta px-4 py-2.5 text-lg font-bold text-tinta">
                <WarningIcon aria-hidden="true" weight="fill" className="size-6 shrink-0" />
                <span className="flex-1">Este pedido cambió: revisa el total.</span>
                <button type="button" onClick={() => setTotalVisto(datos.total)} className="min-h-12 cursor-pointer px-2 underline decoration-2 underline-offset-4">
                  Entendido
                </button>
              </p>
            )}

            <div role="group" aria-label="Cómo se cobra" className="grid grid-cols-3 gap-1 rounded-control border-2 border-borde-fuerte p-1">
              {MODOS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={modo === m.id}
                  disabled={datos.pagado || (enPartes !== null && enPartes.hechas > 0 && m.id !== "partes")}
                  onClick={() => cambiarModo(m.id)}
                  className={`presionable min-h-12 cursor-pointer rounded-interior px-2 text-lg leading-tight font-bold disabled:cursor-not-allowed disabled:opacity-60 ${
                    modo === m.id ? "bg-primario text-tinta" : "text-marino hover:bg-primario-suave"
                  }`}
                >
                  {m.nombre}
                </button>
              ))}
            </div>

            <ul className="flex flex-col divide-y-2 divide-borde">
              {datos.items.map((item) => (
                <FilaDeCuenta
                  key={item.id}
                  item={item}
                  marcable={modoReal === "platos"}
                  marcadas={marcados[item.id] ?? 0}
                  alMarcar={(n) => setMarcados((m) => ({ ...m, [item.id]: n }))}
                />
              ))}
            </ul>

            <Totales cuenta={datos} />

            <button
              type="button"
              onClick={() => setAjustando(true)}
              disabled={centimos(datos.totalPagado) > 0 || datos.pagado}
              className="presionable inline-flex min-h-12 cursor-pointer items-center gap-2 self-start rounded-control border-2 border-marino px-4 text-lg font-bold text-marino hover:bg-primario-suave disabled:cursor-not-allowed disabled:border-borde disabled:text-texto-suave"
            >
              <SlidersHorizontalIcon aria-hidden="true" weight="bold" className="size-6" />
              Ajustar envío, tapers o descuento
            </button>
            {centimos(datos.totalPagado) > 0 && !datos.pagado && (
              <p className="-mt-2 text-base text-texto-suave">Con un pago ya registrado, la cuenta no se puede ajustar.</p>
            )}
          </div>
        )}
      </section>

      {/* ---------- Cobro ---------- */}
      {/* tabIndex -1: tras un clic con el mouse el foco viene aquí, y el Enter siguiente cobra */}
      <section aria-label="Cobro" tabIndex={-1} data-cobro className={`${PANEL} gap-4 p-4 outline-none lg:col-start-2 xl:col-start-auto`}>
        {cobrado ? (
          <div className="flex flex-col gap-5">
            <p role="status" className="flex items-center gap-3 text-3xl font-bold text-tinta">
              <CheckCircleIcon aria-hidden="true" weight="fill" className="size-10 shrink-0 text-listo-fuerte" />
              Cobrado {soles(cobrado.monto)}
            </p>
            {cobrado.vuelto > 0 && (
              <p className="flex flex-col rounded-control bg-listo px-4 py-3 text-tinta">
                <span className="text-2xl font-bold">Vuelto a entregar</span>
                <span className="text-7xl leading-none font-bold tabular-nums">{soles(cobrado.vuelto)}</span>
              </p>
            )}
            {cobrado.pagado ? (
              <>
                <p className="text-xl text-marino">La cuenta quedó pagada.</p>
                <NotaDeVenta pedidoId={pedido.id} />
              </>
            ) : (
              <p className="text-2xl font-bold text-tinta tabular-nums">Falta cobrar {soles(cobrado.saldo)}</p>
            )}
            <button
              ref={botonSiguiente}
              type="button"
              onClick={() => {
                // Un Enter de más justo al cobrar no se lleva la pantalla del vuelto
                if (Date.now() - cobradoEn.current < 700) return;
                if (cobrado.pagado) alSiguiente();
                else setCobrado(null);
              }}
              className="presionable inline-flex min-h-16 cursor-pointer items-center justify-center rounded-control bg-primario px-6 text-2xl font-bold text-tinta hover:bg-primario-presionado"
            >
              {cobrado.pagado ? "Siguiente" : "Seguir con esta cuenta"}
            </button>
          </div>
        ) : datos && !datos.pagado && saldo <= 0 ? (
          <div className="flex flex-col gap-4">
            <p className="text-2xl font-bold text-tinta">Este pedido ya no tiene nada por cobrar</p>
            <p className="text-xl text-marino">Se canceló o cambió desde otro equipo.</p>
            <button
              type="button"
              onClick={alSiguiente}
              className="presionable inline-flex min-h-14 cursor-pointer items-center justify-center rounded-control bg-primario px-6 text-xl font-bold text-tinta hover:bg-primario-presionado"
            >
              Volver a la lista
            </button>
          </div>
        ) : (datos?.pagado ?? pedido.pagado) ? (
          <div className="flex flex-col gap-4">
            <p className="flex items-center gap-3 text-2xl font-bold text-tinta">
              <CheckCircleIcon aria-hidden="true" weight="fill" className="size-9 shrink-0 text-listo-fuerte" />
              Este pedido ya está pagado
            </p>
            <NotaDeVenta pedidoId={pedido.id} />
          </div>
        ) : (
          <>
            <div className="flex flex-col text-tinta">
              <p className="text-2xl font-bold">
                {modoReal === "todo"
                  ? quedanPlatos || modo === "todo"
                    ? "Falta cobrar"
                    : "Resto de la cuenta"
                  : modoReal === "platos"
                    ? "Platos marcados"
                    : `Parte ${parteActual + 1} de ${montosDePartes.length}`}
              </p>
              <p className="text-6xl leading-none font-bold tabular-nums">{soles(objetivo)}</p>
              {modoReal !== "todo" && <p className="mt-1.5 text-lg text-marino tabular-nums">Saldo de la cuenta: {soles(saldo)}</p>}
            </div>

            {modoReal === "partes" && (enPartes === null || enPartes.hechas === 0) && (
              <div className="flex items-center gap-3">
                <p className="flex-1 text-xl font-bold text-tinta">¿Entre cuántas personas?</p>
                <button
                  type="button"
                  aria-label="Una persona menos"
                  disabled={personas <= 2}
                  onClick={() => setPersonas((n) => n - 1)}
                  className="presionable grid size-12 cursor-pointer place-items-center rounded-control border-2 border-marino text-marino disabled:cursor-not-allowed disabled:border-borde disabled:text-texto-suave"
                >
                  <MinusIcon aria-hidden="true" weight="bold" className="size-6" />
                </button>
                <span aria-live="polite" className="w-8 text-center text-3xl font-bold text-tinta tabular-nums">
                  {personas}
                </span>
                <button
                  type="button"
                  aria-label="Una persona más"
                  disabled={personas >= 10}
                  onClick={() => setPersonas((n) => n + 1)}
                  className="presionable grid size-12 cursor-pointer place-items-center rounded-control bg-primario text-tinta disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <PlusIcon aria-hidden="true" weight="bold" className="size-6" />
                </button>
              </div>
            )}

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-control bg-peligro-suave px-4 py-3 text-lg font-bold text-peligro">
                <WarningIcon aria-hidden="true" weight="fill" className="mt-0.5 size-6 shrink-0" />
                {error}
              </p>
            )}

            {/* La clave reinicia el formulario al cambiar de forma de cobro o de parte */}
            <FormularioCobro key={`${modoReal}-${parteActual}`} objetivo={objetivo} bloqueo={bloqueo} alCobrar={cobrar} />
          </>
        )}
      </section>

      {datos && <Ajustar abierto={ajustando} alCerrar={() => setAjustando(false)} pedido={pedido} cuenta={datos} alGuardar={(total) => setTotalVisto(total)} />}
    </>
  );
}

function FilaDeCuenta({ item, marcable, marcadas, alMarcar }: { item: ItemDeCuenta; marcable: boolean; marcadas: number; alMarcar: (n: number) => void }) {
  const libres = item.cantidad - item.cantidadPagada;
  return (
    // En pantallas angostas, el control para marcar baja a su propia línea: el nombre no se aplasta
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5 ${item.pagado ? "text-texto-suave" : "text-tinta"}`}>
      <span className="w-10 shrink-0 text-2xl font-bold tabular-nums">{item.cantidad}×</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xl leading-tight font-bold wrap-anywhere">{item.nombreProducto}</span>
        {item.componentes.length > 0 && <span className="block text-lg leading-snug">{platosDeCombo(item.componentes)}</span>}
        {item.cantidadPagada > 0 && (
          <span className="mt-0.5 flex items-center gap-1 text-lg font-bold text-listo-fuerte">
            <CheckIcon aria-hidden="true" weight="bold" className="size-5 shrink-0" />
            {item.pagado ? "Pagado" : `${item.cantidadPagada} de ${item.cantidad} pagado`}
          </span>
        )}
      </span>
      {marcable && libres > 0 ? (
        libres === 1 ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={marcadas === 1}
            aria-label={`Cobrar ${item.nombreProducto}`}
            onClick={() => alMarcar(marcadas === 1 ? 0 : 1)}
            className={`presionable order-last ml-auto grid size-12 shrink-0 cursor-pointer place-items-center rounded-control border-2 sm:order-none sm:ml-0 ${
              marcadas === 1 ? "border-tinta bg-primario text-tinta" : "border-borde-fuerte bg-superficie text-transparent hover:bg-primario-suave"
            }`}
          >
            <CheckIcon aria-hidden="true" weight="bold" className="size-7" />
          </button>
        ) : (
          <span className="order-last ml-auto flex shrink-0 items-center gap-2 sm:order-none sm:ml-0">
            <button
              type="button"
              aria-label={`Una unidad menos de ${item.nombreProducto}`}
              disabled={marcadas === 0}
              onClick={() => alMarcar(marcadas - 1)}
              className="presionable grid size-12 cursor-pointer place-items-center rounded-control border-2 border-marino text-marino disabled:cursor-not-allowed disabled:border-borde disabled:text-texto-suave"
            >
              <MinusIcon aria-hidden="true" weight="bold" className="size-6" />
            </button>
            <span aria-live="polite" aria-label={`${marcadas} de ${libres} marcadas`} className="w-16 text-center text-xl font-bold tabular-nums">
              {marcadas} de {libres}
            </span>
            <button
              type="button"
              aria-label={`Una unidad más de ${item.nombreProducto}`}
              disabled={marcadas >= libres}
              onClick={() => alMarcar(marcadas + 1)}
              className="presionable grid size-12 cursor-pointer place-items-center rounded-control bg-primario text-tinta disabled:cursor-not-allowed disabled:opacity-60"
            >
              <PlusIcon aria-hidden="true" weight="bold" className="size-6" />
            </button>
          </span>
        )
      ) : null}
      <span className="w-24 shrink-0 text-right text-xl font-bold tabular-nums">{soles(centimos(item.subtotal))}</span>
    </li>
  );
}

// Los montos son los del servidor, tal cual
function Totales({ cuenta }: { cuenta: Cuenta }) {
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
      {centimos(cuenta.totalPagado) > 0 && (
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
