import { BellRingingIcon, CaretRightIcon, CheckIcon, CircleNotchIcon, ReceiptIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { ErrorDeCarga, Esqueleto } from "../../componentes/EstadoDeCarga";
import { PildoraEstado } from "../../componentes/PildoraEstado";
import { consultaPedidosActivos } from "../../lib/consultas";
import { contablesDeItems, contar, conteoDeItems } from "../../lib/conteo";
import { haceCuanto, plural, soles, useAhora } from "../../lib/formato";
import type { Pedido } from "../../lib/tipos";
import { useEntregarListos } from "../../mozo/acciones";
import { listosDe, nombreDePedido, porEntregarDe } from "../../mozo/useAvisosListo";
import { useSesion } from "../../sesion/contexto";

// Platos (lo que pasa por cocina) en alguno de esos estados: el avance de la cocina
const platosEn = (pedido: Pedido, ...estados: string[]) =>
  contar(contablesDeItems(pedido.items.filter((i) => estados.includes(i.estado)))).platos;

export function Pedidos() {
  const { usuario } = useSesion();
  const pedidos = useQuery(consultaPedidosActivos);
  const ahora = useAhora();
  const entregar = useEntregarListos();

  // Mis pedidos: primero los que tienen algo listo, y dentro de cada grupo del más antiguo al más nuevo
  const mios = (pedidos.data ?? [])
    .filter((p) => p.mozo.id === usuario?.id)
    .map((pedido) => ({ pedido, listos: listosDe(pedido).reduce((suma, i) => suma + i.cantidad, 0) }))
    .sort((a, b) => Number(b.listos > 0) - Number(a.listos > 0));

  return (
    <section className="flex flex-1 flex-col gap-5">
      <h1 className="text-3xl font-bold text-tinta">Mis pedidos</h1>

      {!pedidos.data ? (
        pedidos.isError ? (
          <ErrorDeCarga error={pedidos.error} alReintentar={() => void pedidos.refetch()} />
        ) : (
          <div role="status" aria-label="Cargando pedidos" className="flex flex-col gap-3">
            <Esqueleto className="h-36" />
            <Esqueleto className="h-36" />
          </div>
        )
      ) : mios.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-panel border-2 border-dashed border-borde-fuerte px-6 py-10 text-center">
          <ReceiptIcon aria-hidden="true" weight="duotone" className="size-16 text-primario-fuerte" />
          <p className="max-w-[28ch] text-xl text-pretty text-marino">
            No tienes pedidos en curso. Los que tomes desde Mesas aparecerán aquí.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {mios.map(({ pedido, listos }) => {
            const total = contar(contablesDeItems(pedido.items)).platos;
            const hechos = platosEn(pedido, "LISTO", "ENTREGADO");
            return (
              <li key={pedido.id}>
                <article
                  className={`flex flex-col gap-3 rounded-panel p-4 ${
                    listos > 0 ? "border-[3px] border-tinta bg-listo" : "border-2 border-borde-fuerte bg-superficie"
                  }`}
                >
                  <Link to={`/mozo/pedido/${pedido.id}`} className="presionable -m-2 flex items-center gap-3 rounded-control p-2">
                    <div className="min-w-0 flex-1 text-tinta">
                      <h2 className="truncate text-2xl leading-tight font-bold">
                        {pedido.mesa ? nombreDePedido(pedido) : `Para llevar${pedido.cliente?.nombre ? ` · ${pedido.cliente.nombre}` : ""}`}
                      </h2>
                      <p className="text-lg tabular-nums">
                        #{pedido.numero} · {haceCuanto(pedido.creadoEn, ahora)} · {soles(pedido.total)}
                      </p>
                    </div>
                    <CaretRightIcon aria-hidden="true" weight="bold" className="size-6 shrink-0 text-tinta" />
                  </Link>

                  {listos > 0 ? (
                      <p className="flex items-center gap-2 text-xl font-bold text-tinta">
                        <BellRingingIcon aria-hidden="true" weight="fill" className="size-7 shrink-0" />
                        {plural(listos, "plato listo", "platos listos")}
                        {hechos < total ? ` de ${total}` : ""}
                      </p>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <PildoraEstado estado={pedido.estado} />
                      <p className="text-lg text-marino tabular-nums">
                        {hechos > 0 && hechos < total ? `${hechos} de ${plural(total, "plato", "platos")} entregados` : conteoDeItems(pedido.items)}
                      </p>
                    </div>
                  )}
                  {/* También un para llevar de solo bebidas: está listo sin pasar por cocina */}
                  {porEntregarDe(pedido).length > 0 && (
                      <button
                        type="button"
                        disabled={entregar.isPending && entregar.variables?.id === pedido.id}
                        onClick={() => entregar.mutate(pedido)}
                        className="presionable inline-flex min-h-14 cursor-pointer items-center justify-center gap-2.5 rounded-control bg-marino px-6 text-xl font-bold text-white disabled:opacity-60"
                      >
                        {entregar.isPending && entregar.variables?.id === pedido.id ? (
                          <CircleNotchIcon aria-hidden="true" weight="bold" className="size-6 animate-spin" />
                        ) : (
                          <CheckIcon aria-hidden="true" weight="bold" className="size-6" />
                        )}
                        Entregado
                      </button>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
