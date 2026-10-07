import {
  BellRingingIcon,
  CaretRightIcon,
  ClockIcon,
  CloudArrowUpIcon,
  NotePencilIcon,
  ShoppingBagIcon,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { ErrorDeCarga, Esqueleto } from "../../componentes/EstadoDeCarga";
import { PildoraEstado } from "../../componentes/PildoraEstado";
import { consultaMesas, consultaPedidosActivos } from "../../lib/consultas";
import { haceCuanto, plural, soles, useAhora } from "../../lib/formato";
import type { Mesa } from "../../lib/tipos";
import { useCambio } from "../../lib/useCambio";
import { abrirCola, type Borrador, claveParaLlevar, type Envio, esParaLlevar, useMozo } from "../../mozo/almacen";
import { cantidadTotal } from "../../mozo/lineas";
import { listosDe } from "../../mozo/useAvisosListo";

export function Mesas() {
  const mesas = useQuery(consultaMesas);
  const { data: pedidos = [] } = useQuery(consultaPedidosActivos);
  const { borradores, cola } = useMozo();
  const ahora = useAhora();

  // Platos listos por mesa, sea de quien sea el pedido
  const listosPorMesa = new Map<string, number>();
  for (const pedido of pedidos) {
    if (pedido.mesa) listosPorMesa.set(pedido.mesa.id, listosDe(pedido).reduce((suma, i) => suma + i.cantidad, 0));
  }

  const paraLlevar = pedidos.filter((p) => p.tipo === "PARA_LLEVAR");
  const borradoresLlevar = Object.values(borradores).filter((b) => esParaLlevar(b.clave));
  // "Para llevar" abre siempre un borrador nuevo, con su propio id
  const [nuevoLlevar] = useState(claveParaLlevar);

  return (
    <section className="flex flex-1 flex-col gap-5">
      <h1 className="sr-only">Mesas</h1>

      <div className="flex flex-col gap-3">
        <Link
          to={`/mozo/tomar/${nuevoLlevar}`}
          className="presionable flex min-h-16 items-center gap-3 rounded-control bg-primario px-5 text-xl font-bold text-tinta hover:bg-primario-presionado"
        >
          <ShoppingBagIcon aria-hidden="true" weight="bold" className="size-7 shrink-0" />
          <span className="flex-1">Para llevar</span>
          <CaretRightIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
        </Link>
        {/* Cada para llevar a medio anotar es un borrador aparte */}
        {borradoresLlevar.length > 0 && (
          <ul aria-label="Para llevar sin enviar" className="flex flex-col gap-3">
            {borradoresLlevar.map((borrador) => (
              <li key={borrador.clave}>
                <Link
                  to={`/mozo/tomar/${borrador.clave}`}
                  className="presionable flex min-h-14 items-center gap-2.5 rounded-control border-2 border-dashed border-marino bg-superficie px-4 py-2 text-lg leading-tight font-bold text-marino"
                >
                  <NotePencilIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
                  <span className="min-w-0 flex-1">
                    Para llevar{borrador.cliente.trim() ? ` · ${borrador.cliente.trim()}` : ""}: falta enviar ·{" "}
                    {plural(cantidadTotal(borrador.lineas), "plato", "platos")}
                  </span>
                  <CaretRightIcon aria-hidden="true" weight="bold" className="size-5 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {mesas.data ? (
        mesas.data.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3">
            {mesas.data.map((mesa) => (
              <li key={mesa.id}>
                <Baldosa
                  mesa={mesa}
                  listos={listosPorMesa.get(mesa.id) ?? 0}
                  borrador={borradores[`mesa-${mesa.id}`]}
                  envio={cola.find((e) => e.clave === `mesa-${mesa.id}`)}
                  ahora={ahora}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-panel border-2 border-dashed border-borde-fuerte px-6 py-10 text-center text-xl text-pretty text-marino">
            Este negocio todavía no tiene mesas. Pídele al dueño que las registre; mientras tanto puedes tomar pedidos para
            llevar.
          </p>
        )
      ) : mesas.isError ? (
        <ErrorDeCarga error={mesas.error} alReintentar={() => void mesas.refetch()} />
      ) : (
        <div role="status" aria-label="Cargando mesas" className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Esqueleto key={i} className="h-32" />
          ))}
        </div>
      )}

      {paraLlevar.length > 0 && (
        <section aria-labelledby="titulo-llevar" className="mt-3 flex flex-col gap-3">
          <h2 id="titulo-llevar" className="text-2xl font-bold text-tinta">
            Para llevar en curso
          </h2>
          <ul className="flex flex-col gap-3">
            {paraLlevar.map((pedido) => (
              <li key={pedido.id}>
                <Link
                  to={`/mozo/pedido/${pedido.id}`}
                  className="presionable flex min-h-16 items-center gap-3 rounded-control border-2 border-borde-fuerte bg-superficie px-4 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-bold text-tinta">
                      #{pedido.numero}
                      {pedido.cliente?.nombre ? ` · ${pedido.cliente.nombre}` : ""}
                    </p>
                    <p className="text-lg tabular-nums">
                      {soles(pedido.total)} · {haceCuanto(pedido.creadoEn, ahora)}
                    </p>
                  </div>
                  <PildoraEstado estado={pedido.estado} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}

type PropsBaldosa = { mesa: Mesa; listos: number; borrador?: Borrador; envio?: Envio; ahora: number };

const BASE = "presionable flex min-h-32 w-full flex-col justify-between gap-2 rounded-panel p-4 text-left";

// Una mesa en la grilla. El orden nunca cambia: el mozo las ubica de memoria.
function Baldosa({ mesa, listos, borrador, envio, ahora }: PropsBaldosa) {
  const nombre = <span className="text-2xl leading-tight font-bold text-tinta">{mesa.nombre}</span>;
  const pedido = mesa.pedido;
  // Solo se anima cuando los platos pasan a listos con la grilla a la vista
  const acabaDeCambiar = useCambio(listos > 0);

  // Con algo en la cola y la mesa aún libre, tocarla muestra qué falta enviar
  if (envio && !pedido) {
    return (
      <button
        type="button"
        onClick={() => abrirCola(true)}
        className={`${BASE} cursor-pointer border-2 border-alerta-fuerte bg-alerta-suave`}
      >
        {nombre}
        <span className="flex items-center gap-1.5 text-lg font-bold text-alerta-fuerte">
          <CloudArrowUpIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
          {envio.intentos > 0 ? "Esperando conexión" : "Enviando"}
        </span>
      </button>
    );
  }

  if (pedido) {
    const hayListos = listos > 0;
    return (
      <Link
        // La clave reinicia la animación cuando la mesa pasa a tener platos listos
        key={hayListos ? "listo" : "ocupada"}
        to={`/mozo/pedido/${pedido.id}`}
        className={`${BASE} ${
          hayListos ? `${acabaDeCambiar ? "animate-llegada" : ""} border-[3px] border-tinta bg-listo` : "border-2 border-marino bg-primario-suave"
        }`}
      >
        <span className="flex items-start justify-between gap-2">
          {nombre}
          {hayListos && <BellRingingIcon aria-hidden="true" weight="fill" className="size-8 shrink-0 text-tinta" />}
        </span>
        <span className="flex flex-col text-tinta">
          {hayListos ? (
            <span className="text-xl leading-tight font-bold">{plural(listos, "plato listo", "platos listos")}</span>
          ) : envio || borrador ? (
            <span className="flex items-center gap-1.5 text-base leading-tight font-bold">
              {envio ? (
                <CloudArrowUpIcon aria-hidden="true" weight="bold" className="size-5 shrink-0" />
              ) : (
                <NotePencilIcon aria-hidden="true" weight="bold" className="size-5 shrink-0" />
              )}
              {envio ? "Ronda esperando conexión" : "Falta enviar la ronda"}
            </span>
          ) : null}
          <span className="text-xl font-bold tabular-nums">{soles(pedido.total)}</span>
          <span className="flex items-center gap-1.5 text-base font-bold">
            <ClockIcon aria-hidden="true" weight="bold" className="size-5 shrink-0" />
            {haceCuanto(pedido.creadoEn, ahora)}
          </span>
        </span>
      </Link>
    );
  }

  if (borrador) {
    return (
      <Link to={`/mozo/tomar/mesa-${mesa.id}`} className={`${BASE} border-2 border-dashed border-marino bg-superficie`}>
        {nombre}
        <span className="flex items-start gap-1.5 text-lg leading-tight font-bold text-marino">
          <NotePencilIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
          Falta enviar · {plural(cantidadTotal(borrador.lineas), "plato", "platos")}
        </span>
      </Link>
    );
  }

  return (
    <Link to={`/mozo/tomar/mesa-${mesa.id}`} className={`${BASE} border-2 border-borde-fuerte bg-superficie hover:bg-primario-suave`}>
      {nombre}
      <span className="text-lg text-texto-suave">Libre</span>
    </Link>
  );
}
