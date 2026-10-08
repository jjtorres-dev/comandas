import { PencilSimpleIcon, PlusIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useGuardar } from "../../admin/guardar";
import { Boton } from "../../componentes/Boton";
import { ErrorDeCarga, Esqueleto } from "../../componentes/EstadoDeCarga";
import { api } from "../../lib/api";
import { consultaCartaAdmin } from "../../lib/consultas";
import { plural } from "../../lib/formato";
import type { CategoriaAdmin, ProductoAdmin } from "../../lib/tipos";
import { FichaCategoria } from "./carta/FichaCategoria";
import { FichaProducto } from "./carta/FichaProducto";
import { PrecioEditable } from "./carta/PrecioEditable";
import { BotonIcono, Desactivado, Orden, Titulo } from "./piezas";

// Qué ficha está abierta: un plato (o uno nuevo en una categoría) o una categoría
type Ficha = { tipo: "producto"; id: string } | { tipo: "nuevo"; categoriaId: string } | { tipo: "categoria"; id: string | null };

export function Carta() {
  const carta = useQuery(consultaCartaAdmin);
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const { guardar, ocupado } = useGuardar();

  if (carta.isError && !carta.data) return <ErrorDeCarga error={carta.error} alReintentar={() => void carta.refetch()} />;
  if (!carta.data) {
    return (
      <div className="flex flex-col gap-4">
        <Esqueleto className="h-12 w-48" />
        <Esqueleto className="h-64" />
        <Esqueleto className="h-64" />
      </div>
    );
  }

  const { categorias, areas } = carta.data;
  const productos = categorias.flatMap((c) => c.productos);
  // La ficha se arma con lo último del servidor: tras subir o bajar sigue abierta y al día
  const productoAbierto = ficha?.tipo === "producto" ? productos.find((p) => p.id === ficha.id) : undefined;
  const cerrar = () => setFicha(null);

  return (
    <div className="flex flex-col gap-6">
      <Titulo
        titulo="Carta"
        texto="Toca un precio para cambiarlo ahí mismo. Los pedidos ya tomados conservan el precio con el que se pidieron."
        accion={
          <Boton variante="secundario" className="sm:w-auto" icono={<PlusIcon aria-hidden="true" weight="bold" className="size-6" />} onClick={() => setFicha({ tipo: "categoria", id: null })}>
            Nueva categoría
          </Boton>
        }
      />

      {categorias.length === 0 && (
        <p className="rounded-panel border-2 border-dashed border-borde-fuerte px-6 py-10 text-center text-xl text-pretty text-marino">
          La carta está vacía. Empieza por crear una categoría (por ejemplo, Ceviches) y luego agrega sus platos.
        </p>
      )}

      {categorias.map((categoria, i) => (
        <SeccionCategoria
          key={categoria.id}
          categoria={categoria}
          primera={i === 0}
          ultima={i === categorias.length - 1}
          ocupado={ocupado}
          alMover={(direccion) => void guardar(() => api(`/admin/categorias/${categoria.id}/mover`, { metodo: "POST", cuerpo: { direccion } }))}
          alEditar={() => setFicha({ tipo: "categoria", id: categoria.id })}
          alNuevoPlato={() => setFicha({ tipo: "nuevo", categoriaId: categoria.id })}
          alAbrir={(producto) => setFicha({ tipo: "producto", id: producto.id })}
        />
      ))}

      {ficha?.tipo === "categoria" && (
        <FichaCategoria key={ficha.id ?? "nueva"} categoria={categorias.find((c) => c.id === ficha.id) ?? null} alCerrar={cerrar} />
      )}
      {ficha?.tipo === "nuevo" && (
        <FichaProducto key={`nuevo-${ficha.categoriaId}`} producto={null} categoriaId={ficha.categoriaId} categorias={categorias} areas={areas} alCerrar={cerrar} />
      )}
      {productoAbierto && (
        <FichaProducto key={productoAbierto.id} producto={productoAbierto} categoriaId={productoAbierto.categoriaId} categorias={categorias} areas={areas} alCerrar={cerrar} />
      )}
    </div>
  );
}

type PropsCategoria = {
  categoria: CategoriaAdmin;
  primera: boolean;
  ultima: boolean;
  ocupado: boolean;
  alMover: (direccion: "subir" | "bajar") => void;
  alEditar: () => void;
  alNuevoPlato: () => void;
  alAbrir: (producto: ProductoAdmin) => void;
};

function SeccionCategoria({ categoria, primera, ultima, ocupado, alMover, alEditar, alNuevoPlato, alAbrir }: PropsCategoria) {
  return (
    <section aria-label={categoria.nombre} className="overflow-hidden rounded-panel border-2 border-borde bg-superficie">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b-2 border-borde bg-primario-suave px-4 py-3 lg:px-6">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
          <h2 className="text-2xl leading-tight font-bold text-balance text-tinta">{categoria.nombre}</h2>
          {!categoria.activo && <Desactivado texto="Desactivada" />}
          <p className="text-base text-marino">{plural(categoria.productos.length, "plato", "platos")}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Orden de={categoria.nombre} primero={primera} ultimo={ultima} alMover={alMover} ocupado={ocupado} />
          <BotonIcono nombre={`Editar la categoría ${categoria.nombre}`} icono={PencilSimpleIcon} onClick={alEditar} />
        </div>
      </header>

      <ul className="divide-y-2 divide-borde">
        {categoria.productos.map((producto) => (
          <FilaProducto key={producto.id} producto={producto} alAbrir={() => alAbrir(producto)} />
        ))}
      </ul>

      <div className={`px-4 py-3 lg:px-6 ${categoria.productos.length > 0 ? "border-t-2 border-borde" : ""}`}>
        <Boton variante="secundario" className="sm:w-auto" icono={<PlusIcon aria-hidden="true" weight="bold" className="size-6" />} onClick={alNuevoPlato} aria-label={`Nuevo plato en ${categoria.nombre}`}>
          Nuevo plato
        </Boton>
      </div>
    </section>
  );
}

function FilaProducto({ producto, alAbrir }: { producto: ProductoAdmin; alAbrir: () => void }) {
  const variasVariantes = producto.variantes.length > 1;

  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 lg:px-6">
      <button
        type="button"
        onClick={alAbrir}
        aria-label={`Editar ${producto.nombre}`}
        className="presionable -mx-2 flex min-h-12 min-w-0 flex-1 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-control px-2 text-left hover:bg-primario-suave"
      >
        <span className={`text-xl leading-tight font-bold ${producto.activo ? "text-tinta" : "text-texto-suave"}`}>{producto.nombre}</span>
        {producto.esCombo && <span className="inline-flex h-8 items-center rounded-full bg-fondo px-3 text-base font-bold text-marino">Combo de {producto.comboCantidad}</span>}
        {!producto.activo && <Desactivado />}
        <PencilSimpleIcon aria-hidden="true" weight="bold" className="ml-auto size-5 shrink-0 text-texto-suave sm:ml-0" />
      </button>
      <ul aria-label={`Precios de ${producto.nombre}`} className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
        {producto.variantes.map((variante) => (
          <li key={variante.id}>
            <PrecioEditable variante={variante} plato={producto.nombre} conNombre={variasVariantes} />
          </li>
        ))}
      </ul>
    </li>
  );
}
