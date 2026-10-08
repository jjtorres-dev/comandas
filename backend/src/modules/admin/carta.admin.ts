// Mantenimiento de la carta. Nada de aquí toca pedidos ya tomados: cada item
// guarda su propia copia del nombre y del precio.
import { Prisma } from "../../generated/prisma/client";
import { dinero } from "../../lib/dinero";
import { conflicto, noEncontrado, solicitudInvalida } from "../../lib/errores";
import { prisma, type Tx } from "../../lib/prisma";
import type { DatosCrearProducto, DatosEditarProducto } from "./admin.schemas";
import { avisarCambio, mover } from "./comun";

const ordenado = [{ orden: "asc" }, { nombre: "asc" }] satisfies Prisma.CategoriaOrderByWithRelationInput[];

// La carta entera, con lo inactivo, y qué se puede eliminar (lo que nunca se vendió)
export async function cartaCompleta(negocioId: string) {
  const [categorias, areas] = await Promise.all([
    prisma.categoria.findMany({
      where: { negocioId },
      orderBy: ordenado,
      include: {
        productos: {
          orderBy: ordenado,
          include: {
            variantes: { orderBy: { orden: "asc" }, include: { _count: { select: { items: true } } } },
            opcionesCombo: { orderBy: { orden: "asc" }, include: { producto: { select: { id: true, nombre: true } } } },
          },
        },
      },
    }),
    prisma.area.findMany({ where: { negocioId, activo: true }, orderBy: ordenado }),
  ]);

  return {
    areas: areas.map((a) => ({ id: a.id, nombre: a.nombre })),
    categorias: categorias.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      activo: c.activo,
      eliminable: c.productos.length === 0,
      productos: c.productos.map((p) => {
        // Las variantes ya retiradas (inactivas) no se muestran, pero su historial cuenta
        const vendido = p.variantes.some((v) => v._count.items > 0);
        return {
          id: p.id,
          nombre: p.nombre,
          categoriaId: p.categoriaId,
          areaId: p.areaId,
          tapers: p.tapers,
          activo: p.activo,
          esCombo: p.esCombo,
          comboCantidad: p.comboCantidad,
          eliminable: !vendido,
          variantes: p.variantes.filter((v) => v.activo).map((v) => ({ id: v.id, nombre: v.nombre, precio: dinero(v.precio) })),
          opcionesCombo: p.opcionesCombo.map((o) => ({ productoId: o.producto.id, nombre: o.producto.nombre })),
        };
      }),
    })),
  };
}

// ---------- Categorías ----------

const categoriaDe = async (tx: Tx, negocioId: string, id: string) => {
  const categoria = await tx.categoria.findFirst({ where: { id, negocioId } });
  if (!categoria) throw noEncontrado("La categoría no existe");
  return categoria;
};

export async function crearCategoria(negocioId: string, nombre: string) {
  const ultima = await prisma.categoria.aggregate({ where: { negocioId }, _max: { orden: true } });
  const categoria = await prisma.categoria.create({ data: { negocioId, nombre, orden: (ultima._max.orden ?? 0) + 1 } });
  avisarCambio(negocioId);
  return { id: categoria.id };
}

export async function editarCategoria(negocioId: string, id: string, datos: { nombre?: string; activo?: boolean }) {
  await categoriaDe(prisma, negocioId, id);
  await prisma.categoria.update({ where: { id }, data: datos });
  avisarCambio(negocioId);
}

export async function eliminarCategoria(negocioId: string, id: string) {
  await categoriaDe(prisma, negocioId, id);
  if ((await prisma.producto.count({ where: { categoriaId: id } })) > 0) {
    throw conflicto("CON_HISTORIAL", "La categoría tiene platos. Muévelos o elimínalos primero, o desactívala");
  }
  await prisma.categoria.delete({ where: { id } });
  avisarCambio(negocioId);
}

export async function moverCategoria(negocioId: string, id: string, direccion: "subir" | "bajar") {
  await prisma.$transaction(async (tx) => {
    await categoriaDe(tx, negocioId, id);
    const orden = mover(await tx.categoria.findMany({ where: { negocioId }, orderBy: ordenado, select: { id: true } }), id, direccion);
    for (const fila of orden ?? []) await tx.categoria.update({ where: { id: fila.id }, data: { orden: fila.orden } });
  });
  avisarCambio(negocioId);
}

// ---------- Productos ----------

const productoDe = async (tx: Tx, negocioId: string, id: string) => {
  const producto = await tx.producto.findFirst({ where: { id, negocioId }, include: { variantes: { include: { _count: { select: { items: true } } } } } });
  if (!producto) throw noEncontrado("El plato no existe");
  return producto;
};

// La categoría, el área y los platos elegibles tienen que ser de este negocio
async function validarReferencias(tx: Tx, negocioId: string, datos: { categoriaId?: string; areaId?: string; opcionesCombo?: string[] }, propioId?: string) {
  if (datos.categoriaId && !(await tx.categoria.findFirst({ where: { id: datos.categoriaId, negocioId } }))) {
    throw solicitudInvalida("Esa categoría no existe");
  }
  if (datos.areaId && !(await tx.area.findFirst({ where: { id: datos.areaId, negocioId } }))) {
    throw solicitudInvalida("Esa área no existe");
  }
  if (datos.opcionesCombo && datos.opcionesCombo.length > 0) {
    const ids = [...new Set(datos.opcionesCombo)];
    const validos = await tx.producto.count({ where: { id: { in: ids }, negocioId, esCombo: false, ...(propioId ? { NOT: { id: propioId } } : {}) } });
    if (validos !== ids.length) throw solicitudInvalida("Los platos de un combo tienen que ser platos de esta carta que no sean combos");
  }
}

async function guardarOpciones(tx: Tx, comboId: string, productoIds: string[]) {
  await tx.comboOpcion.deleteMany({ where: { comboId } });
  await tx.comboOpcion.createMany({ data: [...new Set(productoIds)].map((productoId, i) => ({ comboId, productoId, orden: i + 1 })) });
}

const nombreDeVariante = (nombre: string, cuantas: number) => (cuantas === 1 ? "Única" : nombre);

export async function crearProducto(negocioId: string, datos: DatosCrearProducto) {
  const id = await prisma.$transaction(async (tx) => {
    await validarReferencias(tx, negocioId, datos);
    const ultimo = await tx.producto.aggregate({ where: { categoriaId: datos.categoriaId }, _max: { orden: true } });
    const producto = await tx.producto.create({
      data: {
        negocioId,
        nombre: datos.nombre,
        categoriaId: datos.categoriaId,
        areaId: datos.areaId,
        tapers: datos.tapers,
        esCombo: datos.esCombo,
        comboCantidad: datos.esCombo ? datos.comboCantidad : null,
        orden: (ultimo._max.orden ?? 0) + 1,
        variantes: {
          create: datos.variantes.map((v, i) => ({ nombre: nombreDeVariante(v.nombre, datos.variantes.length), precio: v.precio, orden: i + 1 })),
        },
      },
    });
    if (datos.esCombo) await guardarOpciones(tx, producto.id, datos.opcionesCombo);
    return producto.id;
  });
  avisarCambio(negocioId);
  return { id };
}

export async function editarProducto(negocioId: string, id: string, datos: DatosEditarProducto) {
  await prisma.$transaction(async (tx) => {
    const producto = await productoDe(tx, negocioId, id);
    await validarReferencias(tx, negocioId, datos, id);
    const esCombo = datos.esCombo ?? producto.esCombo;

    await tx.producto.update({
      where: { id },
      data: {
        nombre: datos.nombre,
        categoriaId: datos.categoriaId,
        areaId: datos.areaId,
        tapers: datos.tapers,
        activo: datos.activo,
        esCombo: datos.esCombo,
        ...(datos.esCombo === false ? { comboCantidad: null } : datos.comboCantidad !== undefined ? { comboCantidad: datos.comboCantidad } : {}),
        // Si cambia de categoría, va al final de la nueva
        ...(datos.categoriaId && datos.categoriaId !== producto.categoriaId
          ? { orden: ((await tx.producto.aggregate({ where: { categoriaId: datos.categoriaId }, _max: { orden: true } }))._max.orden ?? 0) + 1 }
          : {}),
      },
    });

    if (datos.variantes) {
      const enviadas = new Set(datos.variantes.map((v) => v.id).filter(Boolean));
      const activas = producto.variantes.filter((v) => v.activo);
      if ([...enviadas].some((vid) => !producto.variantes.some((v) => v.id === vid))) {
        throw solicitudInvalida("Hay un precio que no es de este plato");
      }
      // Las que ya no vienen: se borran si nunca se vendieron; si no, se retiran sin borrar
      for (const vieja of activas.filter((v) => !enviadas.has(v.id))) {
        if (vieja._count.items > 0) await tx.varianteProducto.update({ where: { id: vieja.id }, data: { activo: false } });
        else await tx.varianteProducto.delete({ where: { id: vieja.id } });
      }
      for (const [i, v] of datos.variantes.entries()) {
        const campos = { nombre: nombreDeVariante(v.nombre, datos.variantes.length), precio: v.precio, orden: i + 1, activo: true };
        if (v.id) await tx.varianteProducto.update({ where: { id: v.id }, data: campos });
        else await tx.varianteProducto.create({ data: { productoId: id, ...campos } });
      }
    }

    if (!esCombo) await tx.comboOpcion.deleteMany({ where: { comboId: id } });
    else if (datos.opcionesCombo) await guardarOpciones(tx, id, datos.opcionesCombo);
    // Un plato que pasa a ser combo deja de poder elegirse dentro de otros combos
    if (datos.esCombo === true) await tx.comboOpcion.deleteMany({ where: { productoId: id } });
  });
  avisarCambio(negocioId);
}

// Cambio rápido de precio desde la lista. Los pedidos ya tomados no cambian.
export async function cambiarPrecio(negocioId: string, varianteId: string, precio: Prisma.Decimal) {
  const variante = await prisma.varianteProducto.findFirst({ where: { id: varianteId, activo: true, producto: { negocioId } } });
  if (!variante) throw noEncontrado("Ese precio no existe");
  await prisma.varianteProducto.update({ where: { id: varianteId }, data: { precio } });
  avisarCambio(negocioId);
  return { id: varianteId, precio: dinero(precio) };
}

export async function eliminarProducto(negocioId: string, id: string) {
  await prisma.$transaction(async (tx) => {
    const producto = await productoDe(tx, negocioId, id);
    if (producto.variantes.some((v) => v._count.items > 0)) {
      throw conflicto("CON_HISTORIAL", "Este plato ya se vendió: no se puede eliminar, solo desactivar");
    }
    // Deja de ser opción en los combos que lo ofrecían
    await tx.comboOpcion.deleteMany({ where: { OR: [{ comboId: id }, { productoId: id }] } });
    await tx.varianteProducto.deleteMany({ where: { productoId: id } });
    await tx.producto.delete({ where: { id } });
  });
  avisarCambio(negocioId);
}

export async function moverProducto(negocioId: string, id: string, direccion: "subir" | "bajar") {
  await prisma.$transaction(async (tx) => {
    const producto = await productoDe(tx, negocioId, id);
    const lista = await tx.producto.findMany({ where: { categoriaId: producto.categoriaId }, orderBy: ordenado, select: { id: true } });
    for (const fila of mover(lista, id, direccion) ?? []) await tx.producto.update({ where: { id: fila.id }, data: { orden: fila.orden } });
  });
  avisarCambio(negocioId);
}
