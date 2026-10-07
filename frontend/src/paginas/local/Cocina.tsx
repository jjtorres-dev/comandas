import {
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  CookingPotIcon,
  FireIcon,
  type Icon,
  MopedIcon,
  PicnicTableIcon,
  ShoppingBagIcon,
  SparkleIcon,
  WarningIcon,
  WifiSlashIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ErrorDeCarga, Esqueleto } from "../../componentes/EstadoDeCarga";
import { consultaCarta, consultaPedidosActivos } from "../../lib/consultas";
import { haceCuanto, platosDeCombo, plural, useAhora } from "../../lib/formato";
import type { ItemPedido, Pedido, TipoPedido } from "../../lib/tipos";
import { cerrarDeshacer, deshacer, marcar, useDeshacer, useOcupado } from "../../local/acciones";
import { armarPanel, type Comanda, type Listo, nombreDeTipo, paraEmpezar, paraListo, tardanzaDe } from "../../local/comandas";
import { fijarArea, silenciar, useTurno } from "../../local/turno";
import { useConexion } from "../../tiempo-real/contexto";

// Cada tipo de pedido tiene su color, su ícono y su palabra. El naranja es el
// de Delivery (excepción de /local a la regla del acento); ámbar, rojo y lima
// quedan libres para "tarda", "muy tarde" y "listo".
const TIPOS: Record<TipoPedido, { icono: Icon; clases: string }> = {
  MESA: { icono: PicnicTableIcon, clases: "border-b-[3px] border-tinta bg-superficie" },
  PARA_LLEVAR: { icono: ShoppingBagIcon, clases: "bg-primario" },
  DELIVERY: { icono: MopedIcon, clases: "bg-acento" },
};

const BOTON = "presionable inline-flex cursor-pointer items-center justify-center gap-2.5 rounded-control px-4 text-center leading-tight font-bold disabled:cursor-not-allowed disabled:opacity-60";
const EMPEZAR = `${BOTON} bg-primario text-tinta hover:bg-primario-presionado`;
const LISTO = `${BOTON} bg-listo text-tinta`;
const CONTORNO = `${BOTON} border-2 border-marino bg-superficie text-marino hover:bg-primario-suave`;

export function Cocina() {
  const pedidos = useQuery(consultaPedidosActivos);
  const { data: carta } = useQuery(consultaCarta);
  const { areaId } = useTurno();
  const ahora = useAhora(15_000);
  const enLinea = useConexion() === "en-linea";

  const areas = useMemo(() => carta?.areas ?? [], [carta]);
  // Un filtro guardado de un área que ya no existe equivale a "Todas"
  const filtro = areas.some((a) => a.id === areaId) ? areaId : null;
  const panel = useMemo(() => (pedidos.data ? armarPanel(pedidos.data, areas, filtro) : null), [pedidos.data, areas, filtro]);
  const nombreFiltro = areas.find((a) => a.id === filtro)?.nombre;

  return (
    <div className="flex flex-1 flex-col gap-4 pb-40 lg:gap-5 lg:pb-8">
      <h1 className="sr-only">Cocina</h1>

      {!enLinea && (
        <p role="alert" className="flex items-center gap-3 rounded-control bg-alerta px-4 py-3 text-xl font-bold text-tinta lg:text-2xl">
          <WifiSlashIcon aria-hidden="true" weight="bold" className="size-8 shrink-0" />
          Sin conexión. Lo que ves puede estar desactualizado.
        </p>
      )}

      {/* En monitor esta fila queda fija bajo la cabecera: el filtro a la izquierda y
          "Deshacer" a la derecha, donde no tapa ninguna tarjeta. En celular, Deshacer
          va abajo, junto al pulgar. */}
      <div className="flex items-center gap-4 lg:-my-2 lg:min-h-21 lg:py-2 xl:sticky xl:top-22 xl:z-10 xl:bg-fondo">
        {areas.length > 1 && (
          <nav aria-label="Filtrar por área">
            <ul className="flex flex-wrap gap-2 lg:gap-3">
              {[{ id: null, nombre: "Todas" }, ...areas].map((area) => {
                const elegida = area.id === filtro;
                return (
                  <li key={area.id ?? "todas"}>
                    <button
                      type="button"
                      aria-pressed={elegida}
                      onClick={() => fijarArea(area.id)}
                      className={`presionable inline-flex min-h-14 cursor-pointer items-center gap-2 rounded-full border-2 px-5 text-xl font-bold lg:px-7 lg:text-2xl ${
                        elegida ? "border-tinta bg-primario text-tinta" : "border-borde-fuerte bg-superficie text-marino hover:bg-primario-suave"
                      }`}
                    >
                      {elegida && <CheckIcon aria-hidden="true" weight="bold" className="size-6" />}
                      {area.nombre}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
        <BarraDeshacer />
      </div>

      {!panel ? (
        pedidos.isError ? (
          <ErrorDeCarga error={pedidos.error} alReintentar={() => void pedidos.refetch()} />
        ) : (
          <div role="status" aria-label="Cargando comandas" className="grid gap-4 lg:grid-cols-2 lg:gap-6">
            <Esqueleto className="h-80" />
            <Esqueleto className="h-80" />
            <Esqueleto className="hidden h-80 lg:block" />
          </div>
        )
      ) : (
        <div className={`flex flex-1 flex-col gap-6 ${panel.listos.length > 0 ? "xl:grid xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start" : ""}`}>
          {panel.comandas.length > 0 ? (
            // Columnas en vez de filas: una tarjeta corta sube al hueco que deja una
            // larga, y un pedido nuevo no queda escondido debajo de la pantalla.
            // Dos columnas en monitor: con los tamaños de lectura a distancia, es el
            // ancho en que una tarjeta de 6 platos cabe entera a 1920×1080.
            <ul aria-label="Comandas" className="flex flex-col gap-4 lg:block lg:columns-2 lg:gap-6 min-[150rem]:columns-3">
              {panel.comandas.map((comanda) => (
                <li key={comanda.pedido.id} className="lg:mb-6 lg:break-inside-avoid">
                  <TarjetaComanda comanda={comanda} ahora={ahora} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex min-h-64 flex-1 flex-col items-center justify-center gap-4 rounded-panel border-2 border-dashed border-borde-fuerte px-6 py-12 text-center">
              <CheckCircleIcon aria-hidden="true" weight="duotone" className="size-20 text-primario-fuerte lg:size-28" />
              <p className="text-3xl font-bold text-tinta lg:text-4xl">{nombreFiltro ? `Nada para ${nombreFiltro} ahora` : "Nada por preparar"}</p>
              <p className="max-w-[36ch] text-xl text-pretty text-marino lg:text-2xl">Los pedidos aparecen aquí apenas el mozo los envía.</p>
            </div>
          )}
          {panel.listos.length > 0 && <RecienListos listos={panel.listos} ahora={ahora} />}
        </div>
      )}

    </div>
  );
}

const minutosEnPalabras = (minutos: number) => (minutos < 60 ? `${minutos} min` : `${Math.floor(minutos / 60)} h ${minutos % 60} min`);

function TarjetaComanda({ comanda, ahora }: { comanda: Comanda; ahora: number }) {
  const { pedido, bloques } = comanda;
  const { recienLlegados } = useTurno();
  const ocupado = useOcupado();
  const tipo = TIPOS[pedido.tipo];
  const { minutos, nivel } = tardanzaDe(comanda.desde, ahora);
  const variosGrupos = bloques.reduce((suma, b) => suma + b.grupos.length, 0) > 1;
  const sinEmpezar = paraEmpezar(comanda.porHacer);
  const nombre = `Pedido ${pedido.numero}`;

  return (
    <article
      aria-label={`${nombre}, ${nombreDeTipo(pedido)}`}
      // Tocar cualquier parte de la tarjeta es "ya lo vi": el aviso de sus rondas nuevas deja de repetirse
      onClick={() => silenciar(bloques.filter((b) => b.nueva).map((b) => `${pedido.id}:${b.idRonda}`))}
      className={`flex flex-col overflow-hidden rounded-panel bg-superficie ${
        nivel === "muy-tarde" ? "border-4 border-peligro" : nivel === "tarda" ? "border-4 border-alerta" : "border-2 border-borde-fuerte"
      } ${recienLlegados.has(pedido.id) ? "animate-destello" : ""}`}
    >
      <header className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-tinta lg:flex-nowrap lg:gap-4 lg:px-5 ${tipo.clases}`}>
        <p className="text-4xl leading-none font-bold tabular-nums lg:text-5xl">
          <span className="sr-only">Pedido </span>#{pedido.numero}
        </p>
        <p className="order-last flex min-w-0 basis-full items-center gap-2 text-2xl leading-tight font-bold lg:order-none lg:flex-1 lg:basis-auto lg:text-3xl">
          <tipo.icono aria-hidden="true" weight="bold" className="size-8 shrink-0 lg:size-10" />
          <span className="min-w-0 wrap-anywhere">{nombreDeTipo(pedido)}</span>
        </p>
        <p
          className={`ml-auto flex shrink-0 flex-col items-end rounded-control border-2 border-tinta px-3 py-1 text-xl leading-tight font-bold tabular-nums lg:text-2xl ${
            nivel === "muy-tarde" ? "bg-peligro text-white" : nivel === "tarda" ? "bg-alerta text-tinta" : "bg-superficie text-tinta"
          }`}
        >
          <span className="flex items-center gap-1.5">
            <ClockIcon aria-hidden="true" weight="bold" className="size-6 lg:size-7" />
            {minutosEnPalabras(minutos)}
          </span>
          {nivel !== "a-tiempo" && <span>{nivel === "tarda" ? "Tarda" : "Muy tarde"}</span>}
        </p>
      </header>

      <div className="flex flex-col gap-2.5 p-3 lg:px-5">
        {pedido.nota && (
          <p className="flex">
            <Nota texto={`Todo el pedido: ${pedido.nota}`} />
          </p>
        )}

        {comanda.rondasHechas.length > 0 && (
          <p className="flex items-center gap-2 text-lg text-texto-suave lg:text-2xl">
            <CheckIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
            {comanda.rondasHechas.length === 1 ? `Ronda ${comanda.rondasHechas[0]}: lista` : `Rondas ${comanda.rondasHechas.join(", ")}: listas`}
          </p>
        )}

        {bloques.map((bloque) => (
          <section key={bloque.idRonda} aria-label={`Ronda ${bloque.numero}`} className="flex flex-col gap-3">
            {(comanda.totalRondas > 1 || bloque.nueva) && (
              <p className="flex items-center gap-2 text-xl font-bold text-tinta lg:text-2xl">
                {comanda.totalRondas > 1 && <span>Ronda {bloque.numero}</span>}
                {bloque.nueva && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primario px-3 py-0.5">
                    <SparkleIcon aria-hidden="true" weight="fill" className="size-5 lg:size-6" />
                    NUEVO
                  </span>
                )}
              </p>
            )}

            {bloque.grupos.map((grupo) => {
              const porEmpezar = paraEmpezar(grupo.items);
              const porTerminar = paraListo(grupo.items);
              // Todo el grupo ya se empezó: se dice una vez arriba, no en cada plato
              const enCurso = porTerminar.length > 0 && porEmpezar.length === 0;
              return (
                <div key={grupo.area.id} className="flex flex-col gap-2">
                  {/* Con más de un área en la tarjeta, cada una se marca por separado */}
                  {(variosGrupos || enCurso) && (
                    <div className="flex min-h-8 items-center gap-3">
                      {variosGrupos && <h2 className="text-xl font-bold text-tinta lg:text-2xl">{grupo.area.nombre}</h2>}
                      <p className="flex min-w-0 flex-1 items-center gap-1.5 text-lg font-bold text-marino lg:text-xl">
                        {enCurso && (
                          <>
                            <CookingPotIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
                            En curso
                          </>
                        )}
                      </p>
                      {variosGrupos && porEmpezar.length > 0 && (
                        <button
                          type="button"
                          disabled={ocupado}
                          aria-label={`Empezar ${grupo.area.nombre}`}
                          onClick={() => void marcar(pedido, porEmpezar, "PREPARANDO", `${nombre}: ${grupo.area.nombre} en preparación`)}
                          className={`${EMPEZAR} min-h-12 text-xl lg:px-6 lg:text-2xl`}
                        >
                          Empezar
                        </button>
                      )}
                      {variosGrupos && porTerminar.length > 0 && (
                        <button
                          type="button"
                          disabled={ocupado}
                          aria-label={`Listo ${grupo.area.nombre}`}
                          onClick={() => void marcar(pedido, porTerminar, "LISTO", `${nombre}: ${grupo.area.nombre} lista`)}
                          className={`${LISTO} min-h-12 text-xl lg:px-6 lg:text-2xl`}
                        >
                          Listo
                        </button>
                      )}
                    </div>
                  )}
                  <ul className="flex flex-col divide-y-2 divide-borde rounded-control border-2 border-borde">
                    {grupo.items.map((item) => (
                      <FilaItem key={item.id} item={item} pedido={pedido} ocupado={ocupado} conEstado={!enCurso} />
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        ))}
      </div>

      <footer className="mt-auto flex gap-3 border-t-2 border-borde p-3 lg:px-5">
        {sinEmpezar.length > 0 && (
          <button
            type="button"
            disabled={ocupado}
            onClick={() => void marcar(pedido, sinEmpezar, "PREPARANDO", `${nombre}: en preparación`)}
            className={`${EMPEZAR} min-h-18 flex-1 text-2xl lg:text-3xl`}
          >
            <FireIcon aria-hidden="true" weight="fill" className="hidden size-8 shrink-0 sm:block" />
            {variosGrupos ? "Empezar todo" : "Empezar"}
          </button>
        )}
        <button
          type="button"
          disabled={ocupado}
          onClick={() => void marcar(pedido, comanda.porHacer, "LISTO", `${nombre}: marcado listo`)}
          className={`${LISTO} min-h-18 flex-1 text-2xl lg:text-3xl`}
        >
          <CheckIcon aria-hidden="true" weight="bold" className="hidden size-8 shrink-0 sm:block" />
          {variosGrupos ? "Todo listo" : "Listo"}
        </button>
      </footer>
    </article>
  );
}

// Las notas son lo que más se olvida en cocina. Su tratamiento (marino con
// texto blanco) es exclusivo: nada más en el contenido de /local lo usa.
function Nota({ texto }: { texto: string }) {
  return (
    <span className="inline-flex items-start gap-2 rounded-interior bg-marino px-2.5 py-1 text-xl leading-snug font-bold text-white lg:text-nota">
      <WarningIcon aria-hidden="true" weight="fill" className="mt-0.5 size-6 shrink-0 lg:mt-1 lg:size-7" />
      <span className="min-w-0 wrap-anywhere">{texto}</span>
    </span>
  );
}

// conEstado = false cuando el grupo entero ya dice "En curso" arriba
function FilaItem({ item, pedido, ocupado, conEstado }: { item: ItemPedido; pedido: Pedido; ocupado: boolean; conEstado: boolean }) {
  const hecho = item.estado === "LISTO" || item.estado === "ENTREGADO";
  const contenido = (
    <>
      <span className="flex w-20 shrink-0 flex-col gap-0.5 lg:w-24">
        <span className={`text-4xl leading-none font-bold tabular-nums lg:text-cantidad ${hecho ? "text-texto-suave" : "text-tinta"}`}>
          {item.cantidad}
          <span className="text-2xl lg:text-3xl">×</span>
        </span>
        {/* El estado va bajo la cantidad: no le quita ancho al nombre ni a las notas */}
        {item.estado !== "PENDIENTE" && (hecho || conEstado) && (
          <span className={`flex items-center gap-1 text-base leading-tight font-bold lg:text-lg text-marino`}>
            {hecho ? <CheckIcon aria-hidden="true" weight="bold" className="size-4 shrink-0" /> : <CookingPotIcon aria-hidden="true" weight="bold" className="size-4 shrink-0" />}
            {hecho ? "Listo" : "En curso"}
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={`min-w-0 text-2xl leading-tight font-bold wrap-anywhere lg:text-plato ${hecho ? "text-texto-suave" : "text-tinta"}`}>{item.nombreProducto}</span>
        {item.componentes.length > 0 && (
          <span className={`basis-full text-xl leading-snug lg:text-2xl ${hecho ? "text-texto-suave" : "text-marino"}`}>{platosDeCombo(item.componentes)}</span>
        )}
        {!hecho && item.notas.map((nota) => <Nota key={nota} texto={nota} />)}
      </span>
    </>
  );

  const descripcion = `${item.cantidad} ${item.nombreProducto}${item.notas.length > 0 ? `, ${item.notas.join(", ")}` : ""}`;

  // Entregado ya no es asunto de la cocina
  if (item.estado === "ENTREGADO") return <li className="flex min-h-14 items-center gap-3 px-3 py-1.5 lg:px-4">{contenido}</li>;

  return (
    <li>
      <button
        type="button"
        disabled={ocupado}
        // Un plato marcado listo por error se devuelve con otro toque, también pasados los segundos de Deshacer
        aria-label={hecho ? `Volver a preparar: ${descripcion}` : `Marcar listo: ${descripcion}`}
        onClick={() =>
          void marcar(
            pedido,
            [item],
            hecho ? "PREPARANDO" : "LISTO",
            `Pedido ${pedido.numero}: ${item.cantidad} ${item.nombreProducto} ${hecho ? "volvió a preparación" : "listo"}`,
          )
        }
        className="presionable flex min-h-14 w-full cursor-pointer items-center gap-3 px-3 py-1.5 text-left hover:bg-primario-suave disabled:cursor-not-allowed disabled:opacity-60 lg:px-4"
      >
        {contenido}
      </button>
    </li>
  );
}

// Cuántos pedidos listos se muestran: si los mozos no marcan "entregado", la lista no crece sin fin
const MAXIMO_LISTOS = 8;

// Lo último que se marcó listo: discreto, para corregir un error o entregar
// un para llevar. Desaparece solo cuando el mozo lo entrega.
function RecienListos({ listos, ahora }: { listos: Listo[]; ahora: number }) {
  const ocupado = useOcupado();
  // En monitor es una columna siempre abierta; en celular, una franja plegada
  const [abierto, setAbierto] = useState(() => window.matchMedia("(min-width: 80rem)").matches);

  return (
    <details open={abierto} onToggle={(e) => setAbierto(e.currentTarget.open)} className="rounded-panel border-2 border-borde bg-fondo">
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 px-4 text-xl font-bold text-marino lg:text-2xl">
        <CheckCircleIcon aria-hidden="true" weight="bold" className="size-7 shrink-0 text-listo-fuerte" />
        <span className="flex-1">{plural(listos.length, "recién listo", "recién listos")}</span>
        <CaretDownIcon aria-hidden="true" weight="bold" className={`size-6 shrink-0 xl:hidden ${abierto ? "rotate-180" : ""}`} />
      </summary>
      <ul className="flex flex-col gap-3 px-3 pb-3">
        {listos.slice(0, MAXIMO_LISTOS).map(({ pedido, items, desde }) => {
          const platos = items.reduce((suma, i) => suma + i.cantidad, 0);
          return (
            <li key={pedido.id} className="flex flex-col gap-3 rounded-control border-2 border-borde bg-superficie p-3">
              <div>
                <p className="text-2xl leading-tight font-bold text-tinta">
                  #{pedido.numero} · {nombreDeTipo(pedido)}
                </p>
                <p className="text-lg text-texto-suave lg:text-xl">
                  {plural(platos, "plato", "platos")} · llegó {haceCuanto(desde, ahora)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={ocupado}
                  aria-label={`Deshacer listo del pedido ${pedido.numero}`}
                  onClick={() => void marcar(pedido, items, "PREPARANDO", `Pedido ${pedido.numero}: volvió a preparación`)}
                  className={`${CONTORNO} min-h-14 px-2 text-lg`}
                >
                  <ArrowCounterClockwiseIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
                  Deshacer
                </button>
                <button
                  type="button"
                  disabled={ocupado}
                  aria-label={`Entregado el pedido ${pedido.numero}`}
                  onClick={() => void marcar(pedido, items, "ENTREGADO", `Pedido ${pedido.numero}: entregado`)}
                  className={`${CONTORNO} min-h-14 px-2 text-lg`}
                >
                  <CheckIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
                  Entregado
                </button>
              </div>
            </li>
          );
        })}
        {listos.length > MAXIMO_LISTOS && (
          <li className="px-1 text-lg text-texto-suave">
            Y {plural(listos.length - MAXIMO_LISTOS, "pedido más", "pedidos más")} sin entregar.
          </li>
        )}
      </ul>
    </details>
  );
}

// Tras cada cambio, unos segundos para arrepentirse con un botón grande
function BarraDeshacer() {
  const cambio = useDeshacer();
  if (!cambio) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] lg:static lg:z-auto lg:min-w-0 lg:flex-1 lg:justify-end lg:p-0">
      <div
        role="status"
        className="pointer-events-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-panel border-[3px] border-tinta bg-superficie shadow-barra lg:rounded-control lg:shadow-none"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 lg:flex-nowrap lg:gap-4 lg:px-4 lg:py-1">
          <p className="min-w-0 basis-full text-xl leading-tight font-bold text-tinta lg:flex-1 lg:basis-auto lg:text-2xl">{cambio.texto}</p>
          <button type="button" onClick={() => void deshacer()} className={`${CONTORNO} min-h-16 flex-1 text-2xl lg:min-h-12 lg:flex-none lg:px-8`}>
            <ArrowCounterClockwiseIcon aria-hidden="true" weight="bold" className="size-7 shrink-0" />
            Deshacer
          </button>
          <button
            type="button"
            onClick={cerrarDeshacer}
            className={`${BOTON} min-h-16 shrink-0 text-xl text-marino underline decoration-2 underline-offset-4 lg:min-h-12 lg:text-2xl`}
          >
            Cerrar
          </button>
        </div>
        {/* La línea se acorta con el tiempo que queda. La clave la reinicia con cada cambio. */}
        <div key={cambio.id} aria-hidden="true" className="h-1.5 origin-left animate-cuenta bg-primario-fuerte" />
      </div>
    </div>
  );
}
