import { ArrowRightIcon, CaretDownIcon, MinusIcon, WarningIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { CabeceraPantalla } from "../../componentes/CabeceraPantalla";
import { ErrorDeCarga, Esqueleto } from "../../componentes/EstadoDeCarga";
import { HojaCombo, HojaVariantes } from "../../componentes/pedido/HojasDeCarta";
import { consultaCarta } from "../../lib/consultas";
import { plural, soles } from "../../lib/formato";
import { useCambio } from "../../lib/useCambio";
import { useEspacioAvisos } from "../../lib/useEspacioAvisos";
import type { Categoria, Producto } from "../../lib/tipos";
import { editarBorrador } from "../../mozo/almacen";
import { FranjaCola } from "../../mozo/FranjaCola";
import { agregar, cantidadDe, cantidadTotal, type Linea, lineaDe, montoTotal, quitarUno } from "../../mozo/lineas";
import { usePedidoEnCurso } from "../../mozo/usePedidoEnCurso";

export function TomarPedido() {
  const { clave = "" } = useParams();
  const enCurso = usePedidoEnCurso(clave);
  const carta = useQuery(consultaCarta);
  const [conVariantes, setConVariantes] = useState<Producto | null>(null);
  const [combo, setCombo] = useState<Producto | null>(null);

  const { destino, borrador } = enCurso;
  const lineas = borrador?.lineas ?? [];
  const guardar = (nuevas: Linea[]) => destino && editarBorrador(clave, destino, { lineas: nuevas });

  function alTocar(producto: Producto) {
    if (producto.esCombo) setCombo(producto);
    else if (producto.variantes.length > 1) setConVariantes(producto);
    else guardar(agregar(lineas, lineaDe(producto, producto.variantes[0])));
  }

  const categorias = useMemo(() => (carta.data?.categorias ?? []).filter((c) => c.productos.length > 0), [carta.data]);
  const platos = cantidadTotal(lineas);
  const platosCambio = useCambio(platos);
  const barraAvisos = useEspacioAvisos();

  if (!destino) return <PantallaSinDestino cargando={enCurso.cargando} />;


  return (
    <div className="flex min-h-dvh flex-col">
      <div className="sticky top-0 z-20">
        <CabeceraPantalla
          titulo={destino.nombre}
          detalle={enCurso.pedidoId ? "Ronda nueva" : "Pedido nuevo"}
          volverA={enCurso.volverA}
          volverTexto={enCurso.pedidoId ? "Volver al pedido" : "Volver a Mesas"}
        />
        <FranjaCola />
        {categorias.length > 0 && <Categorias categorias={categorias} />}
      </div>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+7rem)]">
        {borrador?.motivo && (
          <p role="alert" className="flex items-start gap-2.5 rounded-control bg-peligro-suave px-4 py-3 text-lg font-bold text-peligro">
            <WarningIcon aria-hidden="true" weight="fill" className="mt-0.5 size-6 shrink-0" />
            No se pudo enviar: {borrador.motivo}
          </p>
        )}

        {carta.data ? (
          categorias.map((categoria) => (
            <section key={categoria.id} id={`cat-${categoria.id}`} aria-labelledby={`titulo-${categoria.id}`} className="scroll-mt-36">
              <h2 id={`titulo-${categoria.id}`} className="mb-3 text-2xl font-bold text-tinta">
                {categoria.nombre}
              </h2>
              <ul className="grid grid-cols-2 gap-3">
                {categoria.productos.map((producto) => (
                  <li key={producto.id}>
                    <BotonProducto
                      producto={producto}
                      cantidad={cantidadDe(lineas, producto.id)}
                      alTocar={() => alTocar(producto)}
                      alQuitar={() => guardar(quitarUno(lineas, producto.id))}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : carta.isError ? (
          <ErrorDeCarga error={carta.error} alReintentar={() => void carta.refetch()} />
        ) : (
          <div role="status" aria-label="Cargando la carta" className="grid grid-cols-2 gap-3">
            {Array.from({ length: 8 }, (_, i) => (
              <Esqueleto key={i} className="h-24" />
            ))}
          </div>
        )}
      </main>

      <div ref={barraAvisos} className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-borde bg-superficie px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] shadow-barra">
        <div className="mx-auto max-w-2xl">
          {platos > 0 ? (
            <Link
              to="resumen"
              className="presionable flex min-h-16 items-center gap-3 rounded-control bg-primario px-5 text-xl font-bold text-tinta hover:bg-primario-presionado"
            >
              <span className="flex min-w-0 flex-1 flex-col leading-tight tabular-nums">
                {/* La clave reinicia el pulso: confirma que el toque entró */}
                <span key={platos} className={`origin-left text-lg ${platosCambio ? "animate-pulso" : ""}`}>
                  {plural(platos, "plato", "platos")}
                </span>
                <span className="text-2xl">{soles(montoTotal(lineas))}</span>
              </span>
              <span className="whitespace-nowrap">Ver pedido</span>
              <ArrowRightIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
            </Link>
          ) : (
            <p className="grid min-h-16 place-items-center rounded-control border-2 border-dashed border-borde-fuerte px-5 text-center text-lg text-texto-suave">
              Toca un plato para agregarlo
            </p>
          )}
        </div>
      </div>

      <HojaVariantes
        producto={conVariantes}
        alCerrar={() => setConVariantes(null)}
        alElegir={(producto, variante) => {
          guardar(agregar(lineas, lineaDe(producto, variante)));
          setConVariantes(null);
        }}
      />
      <HojaCombo
        producto={combo}
        alCerrar={() => setCombo(null)}
        alAgregar={(producto, componentes) => {
          guardar(agregar(lineas, lineaDe(producto, producto.variantes[0], componentes)));
          setCombo(null);
        }}
      />
    </div>
  );
}

// La mesa o el pedido de la dirección ya no existen (o todavía cargan)
export function PantallaSinDestino({ cargando }: { cargando: boolean }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <CabeceraPantalla titulo={cargando ? "Cargando" : "Pedido cerrado"} volverA="/mozo/mesas" volverTexto="Volver a Mesas" />
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 pt-6">
        {cargando ? (
          <div role="status" aria-label="Cargando" className="flex flex-col gap-3">
            <Esqueleto className="h-24" />
            <Esqueleto className="h-24" />
          </div>
        ) : (
          <>
            <p className="text-xl text-pretty text-marino">
              Este pedido ya se cobró o se canceló, o la mesa ya no está disponible.
            </p>
            <Link
              to="/mozo/mesas"
              className="presionable flex min-h-14 items-center justify-center rounded-control bg-primario px-6 text-xl font-bold text-tinta"
            >
              Volver a Mesas
            </Link>
          </>
        )}
      </main>
    </div>
  );
}

// Chips deslizables: tocar uno salta a su sección, y al desplazar la carta el
// chip activo acompaña.
function Categorias({ categorias }: { categorias: Categoria[] }) {
  const [activa, setActiva] = useState(categorias[0].id);
  const fila = useRef<HTMLUListElement>(null);
  // Tras un toque, el salto manda: el observador no pisa la elección mientras llega
  const saltando = useRef(0);

  useEffect(() => {
    const observador = new IntersectionObserver(
      (entradas) => {
        if (Date.now() < saltando.current) return;
        const visible = entradas.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiva(visible.target.id.slice(4));
      },
      // Cuenta como "actual" la sección que cruza la franja justo bajo los chips
      { rootMargin: "-150px 0px -65% 0px" },
    );
    for (const c of categorias) {
      const seccion = document.getElementById(`cat-${c.id}`);
      if (seccion) observador.observe(seccion);
    }
    return () => observador.disconnect();
  }, [categorias]);

  // El chip activo siempre queda a la vista dentro de la fila
  useEffect(() => {
    const chip = fila.current?.querySelector<HTMLElement>("[aria-current]");
    const contenedor = fila.current;
    if (!chip || !contenedor) return;
    const sinMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    contenedor.scrollTo({
      left: chip.offsetLeft - contenedor.clientWidth / 2 + chip.clientWidth / 2,
      behavior: sinMovimiento ? "instant" : "smooth",
    });
  }, [activa]);

  return (
    <nav aria-label="Categorías" className="border-b-2 border-borde bg-superficie">
      <ul ref={fila} className="sin-barra relative mx-auto flex max-w-2xl gap-2 overflow-x-auto px-4 py-2.5">
        {categorias.map((c) => (
          <li key={c.id} className="shrink-0">
            <button
              type="button"
              aria-current={c.id === activa ? "true" : undefined}
              onClick={() => {
                saltando.current = Date.now() + 800;
                setActiva(c.id);
                document.getElementById(`cat-${c.id}`)?.scrollIntoView({ block: "start" });
              }}
              className={`presionable min-h-12 cursor-pointer rounded-full border-2 px-4 text-lg font-bold whitespace-nowrap ${
                c.id === activa ? "border-marino bg-marino text-white" : "border-borde-fuerte bg-superficie text-marino"
              }`}
            >
              {c.nombre}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

type PropsProducto = { producto: Producto; cantidad: number; alTocar: () => void; alQuitar: () => void };

function BotonProducto({ producto, cantidad, alTocar, alQuitar }: PropsProducto) {
  const precios = producto.variantes.map((v) => Number(v.precio));
  const elegido = cantidad > 0;
  // El pulso responde al toque; no se dispara al volver a la carta con platos ya anotados
  const cambio = useCambio(cantidad);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={alTocar}
        className={`presionable flex min-h-28 w-full cursor-pointer flex-col justify-between gap-2 rounded-control border-2 p-3 text-left ${
          elegido ? "border-primario-profundo bg-primario-suave" : "border-borde-fuerte bg-superficie"
        }`}
      >
        <span className={`line-clamp-3 text-lg leading-tight font-bold text-tinta ${elegido ? "pr-10" : ""}`}>{producto.nombre}</span>
        <span className="flex items-center gap-1 text-lg leading-tight text-marino tabular-nums">
          {producto.esCombo ? (
            <>
              {soles(precios[0])} · elige {producto.comboCantidad}
            </>
          ) : precios.length > 1 ? (
            <>
              Desde {soles(Math.min(...precios))}
              <CaretDownIcon aria-hidden="true" weight="bold" className="size-4 shrink-0" />
            </>
          ) : (
            soles(precios[0])
          )}
        </span>
        {elegido && (
          <span
            key={cantidad}
            className={`absolute top-2 right-2 grid h-9 min-w-9 place-items-center rounded-full bg-marino px-2 text-xl leading-none font-bold text-white tabular-nums ${cambio ? "animate-pulso" : ""}`}
          >
            {cantidad}
            <span className="sr-only"> en el pedido</span>
          </span>
        )}
      </button>
      {elegido && (
        <button
          type="button"
          onClick={alQuitar}
          aria-label={`Quitar 1 ${producto.nombre}`}
          className="presionable absolute right-1.5 bottom-1.5 grid size-12 cursor-pointer place-items-center rounded-interior border-2 border-marino bg-superficie text-marino"
        >
          <MinusIcon aria-hidden="true" weight="bold" className="size-6" />
        </button>
      )}
    </div>
  );
}
