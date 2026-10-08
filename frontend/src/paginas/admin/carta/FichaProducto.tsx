import { CheckIcon, MinusIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useId, useState } from "react";
import { useGuardar } from "../../../admin/guardar";
import { cuerpoDe, type Ficha, fichaDe, loQueFalta, varianteNueva } from "../../../admin/producto";
import { Boton } from "../../../componentes/Boton";
import { BotonConfirmar } from "../../../componentes/BotonConfirmar";
import { Campo } from "../../../componentes/Campo";
import { Dialogo } from "../../../componentes/Dialogo";
import { Interruptor } from "../../../componentes/Interruptor";
import { api } from "../../../lib/api";
import type { Area, CategoriaAdmin, ProductoAdmin } from "../../../lib/tipos";
import { BotonIcono, NotaDeHistorial, Orden } from "../piezas";

type Props = {
  // null = plato nuevo en `categoriaId`
  producto: ProductoAdmin | null;
  categoriaId: string;
  categorias: CategoriaAdmin[];
  areas: Area[];
  alCerrar: () => void;
};

const etiqueta = "text-lg font-bold text-marino";
const campo = "h-14 w-full rounded-control border-2 border-borde-fuerte bg-superficie px-4 text-xl text-tinta focus:border-marino";

export function FichaProducto({ producto, categoriaId, categorias, areas, alCerrar }: Props) {
  const [ficha, setFicha] = useState<Ficha>(() => fichaDe(producto, categoriaId, areas[0]?.id ?? ""));
  const { guardar, ocupado } = useGuardar();
  const id = useId();
  const cambiar = (cambios: Partial<Ficha>) => setFicha((actual) => ({ ...actual, ...cambios }));
  const falta = loQueFalta(ficha);

  const hermanos = categorias.find((c) => c.id === producto?.categoriaId)?.productos ?? [];
  const posicion = hermanos.findIndex((p) => p.id === producto?.id);
  // Un combo se arma con platos que no son combos
  const elegibles = categorias.flatMap((c) => c.productos).filter((p) => !p.esCombo && p.id !== producto?.id);

  const enviar = async () => {
    if (falta) return;
    const listo = producto
      ? await guardar(() => api(`/admin/productos/${producto.id}`, { metodo: "PATCH", cuerpo: cuerpoDe(ficha, false) }), `${ficha.nombre.trim()} guardado`)
      : await guardar(() => api("/admin/productos", { metodo: "POST", cuerpo: cuerpoDe(ficha, true) }), `${ficha.nombre.trim()} ya está en la carta`);
    if (listo) alCerrar();
  };

  const cambiarVariante = (clave: string, cambios: { nombre?: string; precio?: string }) =>
    cambiar({ variantes: ficha.variantes.map((v) => (v.clave === clave ? { ...v, ...cambios } : v)) });
  const variasVariantes = ficha.variantes.length > 1;

  return (
    <Dialogo
      abierto
      alCerrar={alCerrar}
      titulo={producto ? "Editar plato" : "Nuevo plato"}
      pie={
        <div className="flex flex-col gap-2">
          {falta && (
            <p id={`${id}-falta`} className="text-base font-bold text-marino">
              {falta}
            </p>
          )}
          <Boton type="submit" form={id} disabled={falta !== null} ocupado={ocupado} aria-describedby={falta ? `${id}-falta` : undefined}>
            {producto ? "Guardar" : "Agregar a la carta"}
          </Boton>
        </div>
      }
    >
      <form
        id={id}
        className="flex flex-col gap-6"
        onSubmit={(evento) => {
          evento.preventDefault();
          void enviar();
        }}
      >
        <Campo etiqueta="Nombre" value={ficha.nombre} onChange={(evento) => cambiar({ nombre: evento.target.value })} maxLength={100} autoComplete="off" placeholder="Ej.: Ceviche de pescado" />

        <fieldset className="flex flex-col gap-3">
          <legend className={`${etiqueta} mb-2`}>{variasVariantes ? "Precios" : "Precio"}</legend>
          {ficha.variantes.map((variante, i) => (
            <div key={variante.clave} className="flex items-end gap-2">
              {variasVariantes && (
                <label className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-base text-marino">Tamaño {i + 1}</span>
                  <input value={variante.nombre} onChange={(evento) => cambiarVariante(variante.clave, { nombre: evento.target.value })} maxLength={60} autoComplete="off" placeholder="Ej.: Personal" className={campo} />
                </label>
              )}
              <label className={`flex flex-col gap-1 ${variasVariantes ? "w-32 shrink-0" : "flex-1"}`}>
                <span className="text-base text-marino">{variasVariantes ? `Precio ${i + 1} (S/)` : "En soles"}</span>
                <input
                  value={variante.precio}
                  onChange={(evento) => cambiarVariante(variante.clave, { precio: evento.target.value })}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  className={`${campo} font-bold tabular-nums`}
                />
              </label>
              {variasVariantes && (
                <BotonIcono
                  nombre={`Quitar el precio ${i + 1}`}
                  icono={TrashIcon}
                  onClick={() => cambiar({ variantes: ficha.variantes.filter((v) => v.clave !== variante.clave) })}
                />
              )}
            </div>
          ))}
          {!ficha.esCombo && (
            <Boton variante="texto" className="self-start !w-auto px-2" icono={<PlusIcon aria-hidden="true" weight="bold" className="size-5" />} onClick={() => cambiar({ variantes: [...ficha.variantes, varianteNueva()] })}>
              {variasVariantes ? "Agregar otro precio" : "Tiene varios tamaños o precios"}
            </Boton>
          )}
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-2">
            <span className={etiqueta}>Categoría</span>
            <select value={ficha.categoriaId} onChange={(evento) => cambiar({ categoriaId: evento.target.value })} className={campo}>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2">
            <span className={etiqueta}>Quién lo prepara</span>
            <select value={ficha.areaId} onChange={(evento) => cambiar({ areaId: evento.target.value })} className={campo}>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        <Contador
          etiqueta="Tapers por unidad"
          ayuda="Cuántos tapers se cobran al llevarlo o enviarlo. Las bebidas, 0."
          valor={ficha.tapers}
          minimo={0}
          maximo={10}
          alCambiar={(tapers) => cambiar({ tapers })}
        />

        <div className="flex flex-col gap-3">
          <Interruptor
            etiqueta="Es un combo"
            ayuda="El cliente elige varios platos por un solo precio"
            activo={ficha.esCombo}
            // Un combo tiene un solo precio
            alCambiar={(esCombo) => cambiar({ esCombo, variantes: esCombo ? ficha.variantes.slice(0, 1) : ficha.variantes })}
          />
          {ficha.esCombo && (
            <div className="flex flex-col gap-4 rounded-control bg-fondo p-4">
              <Contador etiqueta="Platos que se eligen" ayuda="2 es un doble, 3 un triple" valor={ficha.comboCantidad} minimo={2} maximo={6} alCambiar={(comboCantidad) => cambiar({ comboCantidad })} />
              <fieldset>
                <legend className={`${etiqueta} mb-2`}>Entre cuáles se elige</legend>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {elegibles.map((plato) => {
                    const marcado = ficha.opcionesCombo.includes(plato.id);
                    return (
                      <li key={plato.id}>
                        <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-control border-2 px-3 py-2 text-lg font-bold text-tinta ${marcado ? "border-marino bg-primario-suave" : "border-borde-fuerte bg-superficie"}`}>
                          <input
                            type="checkbox"
                            checked={marcado}
                            onChange={() => cambiar({ opcionesCombo: marcado ? ficha.opcionesCombo.filter((x) => x !== plato.id) : [...ficha.opcionesCombo, plato.id] })}
                            className="peer sr-only"
                          />
                          <span aria-hidden="true" className={`grid size-7 shrink-0 place-items-center rounded-interior border-2 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-marino ${marcado ? "border-marino bg-marino text-white" : "border-borde-fuerte bg-superficie"}`}>
                            {marcado && <CheckIcon weight="bold" className="size-5" />}
                          </span>
                          {plato.nombre}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            </div>
          )}
        </div>

        {producto && (
          <section aria-label="Más opciones" className="flex flex-col gap-4 border-t-2 border-borde pt-5">
            <Interruptor etiqueta="Se ofrece" ayuda="Apagado, no aparece al tomar un pedido" activo={ficha.activo} alCambiar={(activo) => cambiar({ activo })} />
            <div className="flex items-center justify-between gap-4">
              <p className="text-lg text-marino">
                <span className="font-bold text-tinta">Lugar en su categoría:</span> {posicion + 1} de {hermanos.length}
              </p>
              <Orden
                de={producto.nombre}
                primero={posicion <= 0}
                ultimo={posicion === hermanos.length - 1}
                ocupado={ocupado}
                alMover={(direccion) => void guardar(() => api(`/admin/productos/${producto.id}/mover`, { metodo: "POST", cuerpo: { direccion } }))}
              />
            </div>
            {producto.eliminable ? (
              <BotonConfirmar
                texto="Eliminar plato"
                pregunta="Sí, eliminar"
                ocupado={ocupado}
                icono={<TrashIcon aria-hidden="true" weight="bold" className="size-6" />}
                alConfirmar={() => void guardar(() => api(`/admin/productos/${producto.id}`, { metodo: "DELETE" }), `${producto.nombre} eliminado`).then((listo) => listo && alCerrar())}
              />
            ) : (
              <NotaDeHistorial>Este plato ya se vendió: no se puede eliminar, porque aparece en pedidos y reportes. Si ya no lo ofreces, apágalo.</NotaDeHistorial>
            )}
          </section>
        )}
      </form>
    </Dialogo>
  );
}

type PropsContador = { etiqueta: string; ayuda: string; valor: number; minimo: number; maximo: number; alCambiar: (valor: number) => void };

function Contador({ etiqueta: nombre, ayuda, valor, minimo, maximo, alCambiar }: PropsContador) {
  return (
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-lg font-bold text-marino">{nombre}</p>
        <p className="text-base text-pretty text-texto-suave">{ayuda}</p>
      </div>
      <div role="group" aria-label={nombre} className="flex shrink-0 items-center gap-2">
        <BotonIcono nombre="Uno menos" icono={MinusIcon} disabled={valor <= minimo} onClick={() => alCambiar(valor - 1)} />
        <output aria-live="polite" className="w-8 text-center text-2xl font-bold text-tinta tabular-nums">
          {valor}
        </output>
        <BotonIcono nombre="Uno más" icono={PlusIcon} disabled={valor >= maximo} onClick={() => alCambiar(valor + 1)} />
      </div>
    </div>
  );
}
