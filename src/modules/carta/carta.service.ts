import { dinero } from "../../lib/dinero";
import { prisma } from "../../lib/prisma";

// Carta completa para tomar pedidos: solo lo activo, en el orden configurado
export async function obtenerCarta(negocioId: string) {
  const [categorias, notasRapidas] = await Promise.all([
    prisma.categoria.findMany({
      where: { negocioId, activo: true },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      include: {
        productos: {
          where: { negocioId, activo: true },
          orderBy: [{ orden: "asc" }, { nombre: "asc" }],
          include: {
            variantes: { where: { activo: true }, orderBy: { orden: "asc" } },
            opcionesCombo: {
              where: { producto: { negocioId, activo: true } },
              orderBy: { orden: "asc" },
              include: { producto: { select: { id: true, nombre: true } } },
            },
          },
        },
      },
    }),
    prisma.notaRapida.findMany({
      where: { negocioId, activo: true },
      orderBy: [{ orden: "asc" }, { texto: "asc" }],
    }),
  ]);

  return {
    categorias: categorias.map((c) => ({
      id: c.id,
      nombre: c.nombre,
      productos: c.productos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        imagenUrl: p.imagenUrl,
        areaId: p.areaId,
        esCombo: p.esCombo,
        comboCantidad: p.comboCantidad,
        variantes: p.variantes.map((v) => ({ id: v.id, nombre: v.nombre, precio: dinero(v.precio) })),
        // Solo combos: platos elegibles. Su productoId es lo que se envía en `componentes`
        opcionesCombo: p.opcionesCombo.map((o) => ({
          productoId: o.producto.id,
          nombre: o.producto.nombre,
        })),
      })),
    })),
    notasRapidas: notasRapidas.map((n) => ({ id: n.id, texto: n.texto })),
  };
}
