import { useEspacioAvisos } from "../../lib/useEspacioAvisos";
import { BellRingingIcon, CheckIcon, CircleNotchIcon, CloudArrowUpIcon, PlusIcon, XIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { BotonConfirmar } from "../../componentes/BotonConfirmar";
import { CabeceraPantalla } from "../../componentes/CabeceraPantalla";
import { ErrorDeCarga } from "../../componentes/EstadoDeCarga";
import { PildoraEstado } from "../../componentes/PildoraEstado";
import { consultaPedidosActivos } from "../../lib/consultas";
import { haceCuanto, horaDe, platosDeCombo, plural, soles, useAhora } from "../../lib/formato";
import type { ItemPedido, Pedido } from "../../lib/tipos";
import { useCambio } from "../../lib/useCambio";
import { useCancelarItem, useEntregarListos } from "../../mozo/acciones";
import { useMozo } from "../../mozo/almacen";
import { FranjaCola } from "../../mozo/FranjaCola";
import { listosDe, nombreDePedido } from "../../mozo/useAvisosListo";
import { PantallaSinDestino } from "./TomarPedido";

// Los items con el mismo idRonda se pidieron juntos
function porRondas(items: ItemPedido[]): ItemPedido[][] {
  const rondas = new Map<string, ItemPedido[]>();
  for (const item of items) rondas.set(item.idRonda, [...(rondas.get(item.idRonda) ?? []), item]);
  return [...rondas.values()];
}

export function DetallePedido() {
  const { id = "" } = useParams();
  const pedidos = useQuery(consultaPedidosActivos);
  const ahora = useAhora();
  const barraAvisos = useEspacioAvisos();
  const { cola, borradores } = useMozo();
  const entregar = useEntregarListos();
  const cancelar = useCancelarItem(id);

  const pedido = pedidos.data?.find((p) => p.id === id);
  const listosCambio = useCambio((pedido?.items ?? []).some((i) => i.estado === "LISTO"));

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

  // Una cuenta reabierta ya no es "la mesa": lo que se le agregue va a ese pedido, por su id
  const clave = pedido.mesa && !pedido.mesaLiberada ? `mesa-${pedido.mesa.id}` : `pedido-${pedido.id}`;
  const listos = listosDe(pedido);
  const cantidadListos = listos.reduce((suma, i) => suma + i.cantidad, 0);
  const rondaEnCola = cola.some((e) => e.pedidoId === pedido.id);
  const rondas = porRondas(pedido.items);

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

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+7rem)]">
        {cantidadListos > 0 && (
          <section aria-label="Platos listos" className={`rounded-panel border-[3px] border-tinta bg-listo p-4 text-tinta ${listosCambio ? "animate-llegada" : ""}`}>
            <p className="flex items-center gap-2.5 text-2xl font-bold">
              <BellRingingIcon aria-hidden="true" weight="fill" className="size-8 shrink-0" />
              {plural(cantidadListos, "plato listo", "platos listos")}
            </p>
          </section>
        )}

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

        {rondaEnCola && (
          <p className="flex items-center gap-2.5 rounded-control bg-alerta-suave px-4 py-3 text-lg font-bold text-alerta-fuerte">
            <CloudArrowUpIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
            Hay una ronda esperando conexión
          </p>
        )}

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
                  cancelando={cancelar.isPending && cancelar.variables === item.id}
                  alCancelar={() => cancelar.mutate(item.id)}
                />
              ))}
            </ul>
          </section>
        ))}

        <Totales pedido={pedido} />
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
                  cantidadListos > 0
                    ? "border-2 border-marino bg-superficie text-marino"
                    : "bg-primario text-tinta hover:bg-primario-presionado"
                }`}
              >
                <PlusIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
                {borradores[clave] ? "Seguir la ronda" : "Agregar más"}
              </Link>
              {/* Con platos listos, entregarlos es lo primero: va junto al pulgar */}
              {cantidadListos > 0 && (
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
        <PildoraEstado estado={item.estado} />
        {/* Solo lo que cocina todavía no empezó se puede cancelar desde el salón */}
        {item.estado === "PENDIENTE" && (
          <BotonConfirmar
            texto="Cancelar plato"
            pregunta="Sí, cancelar"
            ocupado={cancelando}
            alConfirmar={alCancelar}
            icono={<XIcon aria-hidden="true" weight="bold" className="size-5" />}
          />
        )}
      </div>
    </li>
  );
}

// Los montos son los del servidor, tal cual
function Totales({ pedido }: { pedido: Pedido }) {
  const conTapers = Number(pedido.cargoTapers) > 0;
  return (
    <dl className="flex flex-col gap-1 border-t-2 border-borde pt-4 text-lg tabular-nums">
      {conTapers && (
        <>
          <div className="flex justify-between gap-3">
            <dt>Subtotal</dt>
            <dd>{soles(pedido.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt>Tapers ({pedido.cantidadTapers})</dt>
            <dd>{soles(pedido.cargoTapers)}</dd>
          </div>
        </>
      )}
      <div className="flex items-baseline justify-between gap-3 text-xl font-bold text-tinta">
        <dt>Total</dt>
        <dd className="text-2xl">{soles(pedido.total)}</dd>
      </div>
    </dl>
  );
}

