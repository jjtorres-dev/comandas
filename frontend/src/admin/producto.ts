// La ficha de un plato: lo que se escribe en pantalla y lo que se envía a la API
import type { ProductoAdmin } from "../lib/tipos";
import { leerMonto, paraApi } from "../local/dinero";

export type VarianteEnFicha = { clave: string; id?: string; nombre: string; precio: string };

export type Ficha = {
  nombre: string;
  categoriaId: string;
  areaId: string;
  tapers: number;
  activo: boolean;
  variantes: VarianteEnFicha[];
  esCombo: boolean;
  comboCantidad: number;
  opcionesCombo: string[];
};

let siguiente = 0;
export const varianteNueva = (): VarianteEnFicha => ({ clave: `nueva-${++siguiente}`, nombre: "", precio: "" });

export function fichaDe(producto: ProductoAdmin | null, categoriaId: string, areaId: string): Ficha {
  if (!producto) {
    return { nombre: "", categoriaId, areaId, tapers: 1, activo: true, variantes: [varianteNueva()], esCombo: false, comboCantidad: 2, opcionesCombo: [] };
  }
  const variasVariantes = producto.variantes.length > 1;
  return {
    nombre: producto.nombre,
    categoriaId: producto.categoriaId,
    areaId: producto.areaId,
    tapers: producto.tapers,
    activo: producto.activo,
    variantes: producto.variantes.map((v) => ({ clave: v.id, id: v.id, nombre: variasVariantes ? v.nombre : "", precio: Number(v.precio).toFixed(2) })),
    esCombo: producto.esCombo,
    comboCantidad: producto.comboCantidad ?? 2,
    opcionesCombo: producto.opcionesCombo.map((o) => o.productoId),
  };
}

// Qué falta para poder guardar, en palabras; null si está completa
export function loQueFalta(ficha: Ficha): string | null {
  if (!ficha.nombre.trim()) return "Escribe el nombre del plato";
  if (ficha.variantes.some((v) => leerMonto(v.precio) === null)) return ficha.variantes.length > 1 ? "Revisa los precios: falta alguno" : "Escribe el precio";
  if (ficha.variantes.length > 1) {
    const nombres = ficha.variantes.map((v) => v.nombre.trim().toLowerCase());
    if (nombres.some((n) => !n)) return "Con varios precios, cada tamaño necesita un nombre (Personal, Fuente…)";
    if (new Set(nombres).size !== nombres.length) return "Hay dos precios con el mismo nombre";
  }
  if (ficha.esCombo && ficha.opcionesCombo.length === 0) return "Marca los platos que se pueden elegir en el combo";
  return null;
}

export function cuerpoDe(ficha: Ficha, esNuevo: boolean) {
  return {
    nombre: ficha.nombre.trim(),
    categoriaId: ficha.categoriaId,
    areaId: ficha.areaId,
    tapers: ficha.tapers,
    variantes: ficha.variantes.map((v) => ({ id: v.id, nombre: v.nombre.trim(), precio: paraApi(leerMonto(v.precio) ?? 0) })),
    esCombo: ficha.esCombo,
    comboCantidad: ficha.esCombo ? ficha.comboCantidad : null,
    opcionesCombo: ficha.esCombo ? ficha.opcionesCombo : [],
    ...(esNuevo ? {} : { activo: ficha.activo }),
  };
}
