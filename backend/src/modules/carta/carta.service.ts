import { dinero } from "../../lib/dinero.js";
import { prisma } from "../../lib/prisma.js";

// Carta completa para tomar pedidos: solo lo activo, en el orden configurado
export async function obtenerCarta(negocioId: string) {
  const [categorias, notasRapidas, areas, negocio] = await Promise.all([
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
    // Áreas de preparación (cocina, bebidas…): el panel de cocina agrupa y filtra por ellas
    prisma.area.findMany({
      where: { negocioId, activo: true },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    }),
    prisma.negocio.findUniqueOrThrow({
      where: { id: negocioId },
      select: { costoEnvioDefault: true, precioTaper: true, distritos: true, region: true, umbralTardaMin: true, umbralMuyTardeMin: true },
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
        tapers: p.tapers,
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
    areas: areas.map((a) => ({ id: a.id, nombre: a.nombre })),
    // Para tomar un pedido por teléfono: lo que hace falta para decirle el total al cliente
    reparto: {
      costoEnvioDefault: dinero(negocio.costoEnvioDefault),
      precioTaper: dinero(negocio.precioTaper),
      distritos: negocio.distritos,
      region: negocio.region,
    },
    // Panel de cocina: minutos a partir de los cuales una comanda tarda o va muy tarde
    cocina: { tardaMin: negocio.umbralTardaMin, muyTardeMin: negocio.umbralMuyTardeMin },
  };
}
