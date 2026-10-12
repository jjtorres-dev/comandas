import { useEspacioAvisos } from "../../lib/useEspacioAvisos";
import { BellRingingIcon, CheckIcon, CircleNotchIcon, CloudArrowUpIcon, MinusIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { toast } from "sonner";
import { BotonConfirmar } from "../../componentes/BotonConfirmar";
import { CabeceraPantalla } from "../../componentes/CabeceraPantalla";
import { ErrorDeCarga } from "../../componentes/EstadoDeCarga";
import { PildoraEstado } from "../../componentes/PildoraEstado";
import { consultaCarta, consultaPedidosActivos } from "../../lib/consultas";
import { haceCuanto, horaDe, platosDeCombo, plural, soles, useAhora } from "../../lib/formato";
import type { ItemPedido, Pedido } from "../../lib/tipos";
import { useCambio } from "../../lib/useCambio";
import { useCancelarItem, useEntregarListos } from "../../mozo/acciones";
import { type Destino, enviarRonda, useMozo } from "../../mozo/almacen";
import { acumular, estadoDeCocina, huellaDeLinea, type LineaDeCuenta, paraQuitar, unaMas } from "../../mozo/cuenta";
import { FranjaCola } from "../../mozo/FranjaCola";
import type { Linea } from "../../mozo/lineas";
import { listosDe, nombreDePedido, porEntregarDe } from "../../mozo/useAvisosListo";
import { PantallaSinDestino } from "./TomarPedido";

// Los items con el mismo idRonda se pidieron juntos
function porRondas(items: ItemPedido[]): ItemPedido[][] {
  const rondas = new Map<string, ItemPedido[]>();
  for (const item of items) rondas.set(item.idRonda, [...(rondas.get(item.idRonda) ?? []), item]);
  return [...rondas.values()];
}

// Tras el último "+", lo que se espera antes de enviar: varios toques seguidos
// ("dos cervezas más") llegan como una sola ronda
const ESPERA_DE_MAS = 1200;

// Las unidades que el mozo va sumando con "+" y todavía no salieron hacia la cola
function useUnidadesDeMas(clave: string, destino: Destino | null, pedidoId: string) {
  const [nuevas, setNuevas] = useState<Record<string, Linea>>({});
  // Lo mismo, a mano para enviarlo al salir de la pantalla
  const vigente = useRef({ nuevas, clave, destino, pedidoId });
  const reloj = useRef<ReturnType<typeof setTimeout>>(undefined);

  const fijar = useCallback((siguientes: Record<string, Linea>) => {
    vigente.current.nuevas = siguientes;
    setNuevas(siguientes);
  }, []);

  const soltar = useCallback(() => {
    clearTimeout(reloj.current);
    const { nuevas: lineas, clave, destino, pedidoId } = vigente.current;
    if (destino) enviarRonda(clave, destino, pedidoId, Object.values(lineas));
    fijar({});
  }, [fijar]);

  useEffect(() => {
    vigente.current = { ...vigente.current, clave, destino, pedidoId };
  });
  // Nada de lo sumado se pierde por volver a Mesas antes de tiempo
  useEffect(() => soltar, [soltar]);

  const cambiar = (huella: string, linea: Linea | null, delta: number) => {
    const previa = vigente.current.nuevas[huella] ?? linea;
    if (!previa) return;
    const cantidad = (vigente.current.nuevas[huella]?.cantidad ?? 0) + delta;
    const siguientes = { ...vigente.current.nuevas };
    if (cantidad > 0) siguientes[huella] = { ...previa, cantidad };
    else delete siguientes[huella];
    fijar(siguientes);
    clearTimeout(reloj.current);
    reloj.current = setTimeout(soltar, ESPERA_DE_MAS);
  };

  return { nuevas, sumar: (huella: string, linea: Linea) => cambiar(huella, linea, 1), restar: (huella: string) => cambiar(huella, null, -1) };
}

export function DetallePedido() {
  const { id = "" } = useParams();
  const pedidos = useQuery(consultaPedidosActivos);
  const { data: carta } = useQuery(consultaCarta);
  const ahora = useAhora();
  const barraAvisos = useEspacioAvisos();
  const { cola, borradores } = useMozo();
  const entregar = useEntregarListos();
  const cancelar = useCancelarItem(id);
  // La cuenta sumada es lo que se mira al llegar a la mesa; las rondas, el detalle
  const [vista, setVista] = useState<"cuenta" | "rondas">("cuenta");

  const pedido = pedidos.data?.find((p) => p.id === id);
  const listosCambio = useCambio((pedido?.items ?? []).some((i) => i.estado === "LISTO" && i.pasaPorCocina));

  // Una cuenta reabierta ya no es "la mesa": lo que se le agregue va a ese pedido, por su id
  const clave = pedido?.mesa && !pedido.mesaLiberada ? `mesa-${pedido.mesa.id}` : `pedido-${id}`;
  const destino: Destino | null = !pedido
    ? null
    : pedido.mesa
      ? { tipo: "MESA", mesaId: pedido.mesa.id, nombre: nombreDePedido(pedido) }
      : { tipo: "PARA_LLEVAR", nombre: nombreDePedido(pedido) };
  const deMas = useUnidadesDeMas(clave, destino, id);

  if (!pedido) {
    if (pedidos.isError) {
      return (
        <div className="flex min-h-dvh flex-col">
          <CabeceraPantalla titulo="Pedido" volverA="/mozo/mesas" volverTexto="Volver a Mesas" />
          <main className="mx-auto w-full max-w-2xl px-4 pt-6">
            <ErrorDeCarga error={pedidos.error} alReintentar={() => void pedidos.refetch()} />
          </main>
        </div>
      );
    }
    return <PantallaSinDestino cargando={pedidos.isPending} />;
  }

  const cantidadListos = listosDe(pedido).reduce((suma, i) => suma + i.cantidad, 0);
  const hayPorEntregar = porEntregarDe(pedido).length > 0;
  const enCola = cola.filter((e) => e.pedidoId === pedido.id);
  const rondas = porRondas(pedido.items);
  const lineas = acumular(pedido.items);

  // Unidades de esta línea que el mozo ya sumó y el servidor todavía no confirma
  const enviando = (linea: LineaDeCuenta) =>
    (deMas.nuevas[linea.huella]?.cantidad ?? 0) +
    enCola.flatMap((e) => e.lineas).reduce((suma, l) => suma + (huellaDeLinea(l) === linea.huella ? l.cantidad : 0), 0);

  function unoMas(linea: LineaDeCuenta) {
    const nueva = carta && unaMas(linea, carta);
    if (nueva) deMas.sumar(linea.huella, nueva);
    else toast.error(carta ? `${linea.nombre} ya no está en la carta. Usa "Agregar más".` : "La carta todavía está cargando", { id: "sin-carta" });
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <div className="sticky top-0 z-20">
        <CabeceraPantalla
          titulo={pedido.mesa ? nombreDePedido(pedido) : "Para llevar"}
          detalle={`Pedido #${pedido.numero} · ${haceCuanto(pedido.creadoEn, ahora)}`}
          volverA="/mozo/mesas"
          volverTexto="Volver a Mesas"
        />
        <FranjaCola />
      </div>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+7rem)]">
        {cantidadListos > 0 && (
          <section aria-label="Platos listos" className={`rounded-panel border-[3px] border-tinta bg-listo p-4 text-tinta ${listosCambio ? "animate-llegada" : ""}`}>
            <p className="flex items-center gap-2.5 text-2xl font-bold">
              <BellRingingIcon aria-hidden="true" weight="fill" className="size-8 shrink-0" />
              {plural(cantidadListos, "plato listo", "platos listos")}
            </p>
          </section>
        )}

        <TotalDeLaCuenta pedido={pedido} />

        {(pedido.cliente?.nombre || pedido.nota) && (
          <dl className="flex flex-col gap-1 text-lg">
            {pedido.cliente?.nombre && (
              <div className="flex gap-2">
                <dt className="text-texto-suave">A nombre de</dt>
                <dd className="font-bold text-tinta">{pedido.cliente.nombre}</dd>
              </div>
            )}
            {pedido.nota && (
              <div className="flex gap-2">
                <dt className="shrink-0 text-texto-suave">Nota</dt>
                <dd className="font-bold text-tinta">{pedido.nota}</dd>
              </div>
            )}
          </dl>
        )}

        {enCola.some((e) => e.intentos > 0) && (
          <p className="flex items-center gap-2.5 rounded-control bg-alerta-suave px-4 py-3 text-lg font-bold text-alerta-fuerte">
            <CloudArrowUpIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
            Hay una ronda esperando conexión
          </p>
        )}

        <div role="group" aria-label="Cómo ver el pedido" className="grid grid-cols-2 gap-1 rounded-control border-2 border-borde-fuerte bg-superficie p-1">
          {(["cuenta", "rondas"] as const).map((opcion) => (
            <button
              key={opcion}
              type="button"
              aria-pressed={vista === opcion}
              onClick={() => setVista(opcion)}
              className={`presionable min-h-12 cursor-pointer rounded-interior px-2 text-lg font-bold ${vista === opcion ? "bg-marino text-white" : "text-marino hover:bg-primario-suave"}`}
            >
              {opcion === "cuenta" ? "Todo junto" : "Por rondas"}
            </button>
          ))}
        </div>

        {vista === "cuenta" ? (
          <ul aria-label="Todo lo pedido" className="divide-y-2 divide-borde rounded-control border-2 border-borde-fuerte bg-superficie">
            {lineas.map((linea) => (
              <LineaAcumulada
                key={linea.clave}
                linea={linea}
                enviando={enviando(linea)}
                editable={!pedido.pagado}
                quitando={cancelar.isPending && linea.items.some((i) => i.id === cancelar.variables?.itemId)}
                alSumar={() => unoMas(linea)}
                alQuitar={() => {
                  // Lo que todavía no salió del celular se quita sin molestar a nadie
                  if (deMas.nuevas[linea.huella]) return deMas.restar(linea.huella);
                  const item = paraQuitar(linea);
                  if (item) cancelar.mutate({ itemId: item.id, cantidad: 1 });
                }}
              />
            ))}
          </ul>
        ) : (
          <>
            {rondas.map((items, indice) => (
              <section key={items[0].idRonda} aria-labelledby={`ronda-${indice}`}>
                <h2 id={`ronda-${indice}`} className="mb-2 flex items-baseline justify-between gap-3 text-xl font-bold text-tinta">
                  Ronda {indice + 1}
                  <span className="text-lg font-normal text-texto-suave tabular-nums">{horaDe(items[0].creadoEn)}</span>
                </h2>
                <ul className="divide-y-2 divide-borde rounded-control border-2 border-borde-fuerte bg-superficie">
                  {items.map((item) => (
                    <ItemDePedido
                      key={item.id}
                      item={item}
                      cancelando={cancelar.isPending && cancelar.variables?.itemId === item.id}
                      alCancelar={() => cancelar.mutate({ itemId: item.id })}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </>
        )}
      </main>

      <div ref={barraAvisos} className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-borde bg-superficie px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-barra">
        <div className="mx-auto max-w-2xl">
          {pedido.pagado ? (
            <p className="grid min-h-16 place-items-center text-center text-lg font-bold text-marino">
              Este pedido ya está pagado: no admite más rondas
            </p>
          ) : (
            <div className="flex gap-3">
              <Link
                to={`/mozo/tomar/${clave}`}
                className={`presionable flex min-h-16 flex-1 items-center justify-center gap-2 rounded-control px-3 text-center text-xl leading-tight font-bold whitespace-nowrap ${
                  hayPorEntregar
                    ? "border-2 border-marino bg-superficie text-marino"
                    : "bg-primario text-tinta hover:bg-primario-presionado"
                }`}
              >
                <PlusIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
                {borradores[clave] ? "Seguir la ronda" : "Agregar más"}
              </Link>
              {/* Con platos listos, entregarlos es lo primero: va junto al pulgar */}
              {hayPorEntregar && (
                <button
                  type="button"
                  disabled={entregar.isPending}
                  aria-busy={entregar.isPending || undefined}
                  onClick={() => entregar.mutate(pedido)}
                  className="presionable inline-flex min-h-16 flex-1 cursor-pointer items-center justify-center gap-2 rounded-control bg-marino px-4 text-xl font-bold text-white disabled:opacity-60"
                >
                  {entregar.isPending ? (
                    <CircleNotchIcon aria-hidden="true" weight="bold" className="size-6 animate-spin" />
                  ) : (
                    <CheckIcon aria-hidden="true" weight="bold" className="size-6" />
                  )}
                  Entregado
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// El total de la mesa, grande: es lo que el cliente pregunta. Los montos son
// los del servidor, tal cual.
function TotalDeLaCuenta({ pedido }: { pedido: Pedido }) {
  const totalCambio = useCambio(pedido.total);
  const conTapers = Number(pedido.cargoTapers) > 0;
  const conPagos = Number(pedido.totalPagado) > 0 && !pedido.pagado;
  return (
    <section aria-labelledby="titulo-cuenta" className="flex flex-col gap-1">
      <h2 id="titulo-cuenta" className="text-xl font-bold text-marino">
        {pedido.mesa ? "Cuenta de la mesa" : "Cuenta del pedido"}
      </h2>
      {/* La clave reinicia el pulso cuando el total cambia a la vista */}
      <p key={pedido.total} className={`origin-left text-5xl leading-none font-bold text-tinta tabular-nums ${totalCambio ? "animate-pulso" : ""}`}>
        {soles(pedido.total)}
      </p>
      {conTapers && (
        <p className="text-lg text-marino tabular-nums">
          {soles(pedido.subtotal)} + {plural(pedido.cantidadTapers, "taper", "tapers")} {soles(pedido.cargoTapers)}
        </p>
      )}
      {conPagos && (
        <p className="text-lg font-bold text-marino tabular-nums">
          Ya pagó {soles(pedido.totalPagado)} · falta {soles(pedido.saldoPendiente)}
        </p>
      )}
    </section>
  );
}

const CUADRADO = "presionable grid size-12 shrink-0 cursor-pointer place-items-center rounded-control";

type PropsLinea = { linea: LineaDeCuenta; enviando: number; editable: boolean; quitando: boolean; alSumar: () => void; alQuitar: () => void };

// "6× Cerveza Pilsen · S/ 54.00": lo mismo de todas las rondas en una fila,
// con cómo va en cocina y "−" y "+" para corregir de a una unidad
function LineaAcumulada({ linea, enviando, editable, quitando, alSumar, alQuitar }: PropsLinea) {
  const [confirmando, setConfirmando] = useState(false);
  const cantidadCambio = useCambio(linea.cantidad);
  // Lo recién sumado se quita sin preguntar; lo demás, solo si cocina no lo empezó
  const seQuita = enviando > 0 || paraQuitar(linea) !== null;

  useEffect(() => {
    if (!confirmando) return;
    const reloj = setTimeout(() => setConfirmando(false), 4000);
    return () => clearTimeout(reloj);
  }, [confirmando]);

  function menos() {
    if (enviando > 0) return alQuitar();
    if (!seQuita) {
      toast.error("Ya se está preparando: pídelo a cocina", { id: `no-se-quita-${linea.clave}` });
      return;
    }
    setConfirmando(true);
  }

  return (
    <li className="flex flex-col gap-2 p-3">
      <div className="flex items-start gap-3">
        <span key={linea.cantidad} className={`min-w-9 shrink-0 text-2xl leading-tight font-bold text-tinta tabular-nums ${cantidadCambio ? "animate-pulso" : ""}`}>
          {linea.cantidad}×
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xl leading-tight font-bold text-tinta">{linea.nombre}</p>
          {linea.componentes.length > 0 && <p className="mt-1 text-lg leading-snug text-marino">{platosDeCombo(linea.componentes)}</p>}
          {linea.notas.length > 0 && (
            <ul aria-label="Notas" className="mt-1.5 flex flex-wrap gap-2">
              {linea.notas.map((nota) => (
                <li key={nota} className="rounded-interior border-2 border-borde-fuerte bg-fondo px-2.5 py-0.5 text-lg leading-tight font-bold text-tinta">
                  {nota}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="shrink-0 text-xl leading-tight font-bold text-tinta tabular-nums">{soles(linea.centimos / 100)}</p>
      </div>

      <div className="flex items-center gap-2">
        <ul aria-label="En cocina" className="mr-auto flex min-w-0 flex-wrap items-center gap-1.5">
          {estadoDeCocina(linea).map(({ estado, cantidad }) => (
            <li key={estado} className="flex">
              <PildoraEstado estado={estado} cantidad={cantidad} />
            </li>
          ))}
          {enviando > 0 && (
            <li className="inline-flex h-8 items-center gap-1.5 rounded-full bg-fondo px-3 text-base font-bold text-marino">
              <CircleNotchIcon aria-hidden="true" weight="bold" className="size-5 animate-spin motion-reduce:animate-none" />
              +{enviando} enviando
            </li>
          )}
        </ul>

        {editable &&
          (confirmando ? (
            // Ocupa el sitio exacto de "−" y "+": nada se mueve bajo el dedo
            <button
              type="button"
              onClick={() => {
                setConfirmando(false);
                alQuitar();
              }}
              className="presionable h-12 w-26 shrink-0 cursor-pointer rounded-control bg-peligro text-lg font-bold whitespace-nowrap text-white"
            >
              Sí, quitar 1
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={menos}
                disabled={quitando}
                aria-label={`Quitar 1 ${linea.nombre}`}
                // Apagado, pero responde: al tocarlo explica por qué no se puede
                className={`${CUADRADO} border-2 disabled:opacity-60 ${seQuita ? "border-marino text-marino" : "border-borde-fuerte text-texto-suave"}`}
              >
                {quitando ? <CircleNotchIcon aria-hidden="true" weight="bold" className="size-6 animate-spin" /> : <MinusIcon aria-hidden="true" weight="bold" className="size-6" />}
              </button>
              <button type="button" onClick={alSumar} aria-label={`Uno más de ${linea.nombre}`} className={`${CUADRADO} bg-primario text-tinta hover:bg-primario-presionado`}>
                <PlusIcon aria-hidden="true" weight="bold" className="size-6" />
              </button>
            </>
          ))}
      </div>
    </li>
  );
}

function ItemDePedido({ item, cancelando, alCancelar }: { item: ItemPedido; cancelando: boolean; alCancelar: () => void }) {
  const cancelado = item.estado === "CANCELADO";
  return (
    <li className="flex flex-col gap-2 p-3">
      <div className="flex items-start gap-3">
        <span className={`w-8 shrink-0 text-xl font-bold tabular-nums ${cancelado ? "text-texto-suave" : "text-tinta"}`}>{item.cantidad}×</span>
        <div className="min-w-0 flex-1">
          <p className={`text-xl leading-tight font-bold ${cancelado ? "text-texto-suave line-through" : "text-tinta"}`}>
            {item.nombreProducto}
          </p>
          {item.componentes.length > 0 && <p className="mt-1 text-lg leading-snug text-marino">{platosDeCombo(item.componentes)}</p>}
          {item.notas.length > 0 && !cancelado && (
            <ul aria-label="Notas" className="mt-1.5 flex flex-wrap gap-2">
              {item.notas.map((nota) => (
                <li key={nota} className="rounded-interior border-2 border-borde-fuerte bg-fondo px-2.5 py-0.5 text-lg leading-tight font-bold text-tinta">
                  {nota}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Lo que no pasa por cocina no tiene estado que seguir */}
        {item.pasaPorCocina || cancelado ? <PildoraEstado estado={item.estado} /> : <span />}
        {/* Desde el salón se cancela lo que cocina todavía no empezó, y lo que no pasa por cocina */}
        {(item.estado === "PENDIENTE" || (!item.pasaPorCocina && !cancelado)) && (
          <BotonConfirmar
            texto={item.pasaPorCocina ? "Cancelar plato" : "Quitar"}
            pregunta={item.pasaPorCocina ? "Sí, cancelar" : "Sí, quitar"}
            ocupado={cancelando}
            alConfirmar={alCancelar}
            icono={<XIcon aria-hidden="true" weight="bold" className="size-5" />}
          />
        )}
      </div>
    </li>
  );
}
