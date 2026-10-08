import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { type RefObject, useId, useMemo, useState } from "react";
import { HojaCombo, HojaVariantes } from "../../../componentes/pedido/HojasDeCarta";
import type { Carta, Producto } from "../../../lib/tipos";
import { centimos, soles } from "../../../local/dinero";
import { sinTildes } from "../../../local/delivery";
import { type Linea, lineaDe } from "../../../mozo/lineas";

type Props = {
  carta: Carta;
  alAgregar: (linea: Linea) => void;
  // Para devolverle el foco desde fuera (tras elegir el cliente, por ejemplo)
  campo?: RefObject<HTMLInputElement | null>;
  // Sin buscar no se lista la carta entera (para espacios chicos, como un diálogo)
  soloResultados?: boolean;
};

// La carta para quien atiende una llamada: se escribe "cevi", se filtra al
// instante y Enter agrega el primer resultado. Variantes y combos se eligen
// con las mismas hojas que usa el mozo.
export function BuscadorDeCarta({ carta, alAgregar, campo, soloResultados = false }: Props) {
  const [texto, setTexto] = useState("");
  // Cuál de los resultados agrega Enter (se mueve con las flechas)
  const [resaltado, setResaltado] = useState(0);
  const [conVariantes, setConVariantes] = useState<Producto | null>(null);
  const [combo, setCombo] = useState<Producto | null>(null);
  const idLista = useId();

  const buscado = sinTildes(texto);
  const resultados = useMemo(() => {
    if (!buscado) return [];
    const productos = carta.categorias.flatMap((c) => c.productos);
    // Primero los que empiezan con lo escrito, después los que lo contienen
    const empiezan = productos.filter((p) => sinTildes(p.nombre).split(" ").some((palabra) => palabra.startsWith(buscado)));
    const contienen = productos.filter((p) => !empiezan.includes(p) && sinTildes(p.nombre).includes(buscado));
    return [...empiezan, ...contienen].slice(0, 8);
  }, [carta, buscado]);

  // Tras agregar, el buscador queda limpio y con el foco, listo para el siguiente plato
  function listo(linea: Linea) {
    alAgregar(linea);
    setTexto("");
    setResaltado(0);
    requestAnimationFrame(() => campo?.current?.focus());
  }

  function elegir(producto: Producto) {
    if (producto.esCombo) setCombo(producto);
    else if (producto.variantes.length > 1) setConVariantes(producto);
    else listo(lineaDe(producto, producto.variantes[0]));
  }

  const precioDe = (producto: Producto) => {
    const precios = producto.variantes.map((v) => centimos(v.precio));
    return precios.length > 1 && !producto.esCombo ? `desde ${soles(Math.min(...precios))}` : soles(precios[0]);
  };

  const fila = (producto: Producto, indice: number | null) => (
    <button
      key={producto.id}
      type="button"
      // Con el mouse también se agrega; el foco vuelve al buscador
      onClick={() => elegir(producto)}
      className={`presionable flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-interior px-3 py-1.5 text-left text-xl ${
        indice !== null && indice === resaltado ? "bg-primario-suave font-bold text-tinta outline-2 outline-marino" : "text-tinta hover:bg-primario-suave"
      }`}
    >
      <span className="min-w-0 flex-1 leading-tight font-bold">{producto.nombre}</span>
      <span className="shrink-0 text-lg text-marino tabular-nums">{producto.esCombo ? `${precioDe(producto)} · elige ${producto.comboCantidad}` : precioDe(producto)}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <MagnifyingGlassIcon aria-hidden="true" weight="bold" className="pointer-events-none absolute top-1/2 left-4 size-6 -translate-y-1/2 text-marino" />
        <input
          ref={campo}
          role="combobox"
          aria-label="Buscar en la carta"
          aria-expanded={resultados.length > 0}
          aria-controls={idLista}
          autoComplete="off"
          placeholder="Buscar plato: escribe y pulsa Enter"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setResaltado(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              e.stopPropagation();
              const paso = e.key === "ArrowDown" ? 1 : -1;
              setResaltado((r) => Math.min(resultados.length - 1, Math.max(0, r + paso)));
            } else if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
              e.preventDefault();
              e.stopPropagation();
              if (resultados[resaltado]) elegir(resultados[resaltado]);
            } else if (e.key === "Escape" && texto) {
              // El primer Esc limpia lo escrito; el siguiente ya es de la pantalla
              e.stopPropagation();
              setTexto("");
            }
          }}
          className="h-16 w-full rounded-control border-2 border-borde-fuerte bg-superficie pr-4 pl-13 text-2xl text-tinta placeholder:text-texto-suave focus:border-marino"
        />
      </div>

      <div id={idLista}>
        {buscado ? (
          resultados.length > 0 ? (
            <ul aria-label="Resultados" className="flex flex-col gap-1">
              {resultados.map((producto, indice) => (
                <li key={producto.id}>{fila(producto, indice)}</li>
              ))}
            </ul>
          ) : (
            <p className="rounded-control border-2 border-dashed border-borde-fuerte px-4 py-6 text-center text-xl text-marino">
              No hay nada en la carta con "{texto.trim()}"
            </p>
          )
        ) : soloResultados ? null : (
          // Sin buscar, la carta completa por categorías, para elegir con el mouse
          <div className="flex flex-col gap-4">
            {carta.categorias
              .filter((c) => c.productos.length > 0)
              .map((categoria) => (
                <section key={categoria.id} aria-label={categoria.nombre}>
                  <h3 className="mb-1 text-lg font-bold text-texto-suave">{categoria.nombre}</h3>
                  <ul className="grid gap-x-3 sm:grid-cols-2">
                    {categoria.productos.map((producto) => (
                      <li key={producto.id}>{fila(producto, null)}</li>
                    ))}
                  </ul>
                </section>
              ))}
          </div>
        )}
      </div>

      <HojaVariantes
        producto={conVariantes}
        alCerrar={() => setConVariantes(null)}
        alElegir={(producto, variante) => {
          setConVariantes(null);
          listo(lineaDe(producto, variante));
        }}
      />
      <HojaCombo
        producto={combo}
        alCerrar={() => setCombo(null)}
        alAgregar={(producto, componentes) => {
          setCombo(null);
          listo(lineaDe(producto, producto.variantes[0], componentes));
        }}
      />
    </div>
  );
}
