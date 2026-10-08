// ============================================================
//  Seed de desarrollo: Cevichería Valentina (Tarapoto, Perú)
//  Idempotente: borra todos los datos de ese negocio (incluidos
//  pedidos, pagos y turnos de caja) y los vuelve a crear.
// ============================================================

import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Rol } from "../src/generated/prisma/client";

const NOMBRE_NEGOCIO = "Cevichería Valentina";
const CODIGO_NEGOCIO = "valentina"; // con este código se inicia sesión
// Archivo en backend/public/uploads/negocios/, servido en /uploads
const LOGO_NEGOCIO = "/uploads/negocios/valentina.png";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ---------- DATOS ----------

// Contraseñas de desarrollo: se cambian antes de salir a producción
const USUARIOS: { usuario: string; nombre: string; password: string; roles: Rol[] }[] = [
  { usuario: "admin", nombre: "Administrador", password: "admin123", roles: [Rol.ADMIN] },
  { usuario: "mozo", nombre: "Mozo", password: "mozo123", roles: [Rol.MOZO] },
  // Cocina y caja la hace la misma persona
  { usuario: "cocina", nombre: "Cocina", password: "cocina123", roles: [Rol.LOCAL] },
];

const NOTAS_RAPIDAS = [
  "Sin cebolla",
  "Ají aparte",
  "Con picante",
  "Sin picante",
  "Bien helado",
  "Sin culantro",
];

type VarianteSeed = { nombre: string; precio: number };
type ProductoSeed = {
  nombre: string;
  // Un número = una sola variante "Única" con ese precio
  precio: number | VarianteSeed[];
  comboCantidad?: number;
};
type CategoriaSeed = { nombre: string; area: "Cocina" | "Bebidas"; productos: ProductoSeed[] };

const CARTA: CategoriaSeed[] = [
  {
    nombre: "Ceviches y leches",
    area: "Cocina",
    productos: [
      { nombre: "Leche de Tigre", precio: 12 },
      { nombre: "Leche de Tigre Mixta", precio: 20 },
      { nombre: "Ceviche Simple", precio: 20 },
      { nombre: "Ceviche Carretillero", precio: 24 },
      { nombre: "Ceviche Mixto", precio: 30 },
      { nombre: "Ceviche de Langostino", precio: 26 },
    ],
  },
  {
    nombre: "Sudados",
    area: "Cocina",
    productos: [
      { nombre: "Sudado de Pescado", precio: 25 },
      { nombre: "Sudado de Filete", precio: 20 },
      { nombre: "Parihuela", precio: 35 },
    ],
  },
  {
    nombre: "Arroces y chaufas",
    area: "Cocina",
    productos: [
      { nombre: "Arroz con Mariscos", precio: 22 },
      { nombre: "Arroz con Langostinos", precio: 28 },
      { nombre: "Chaufa de Mariscos", precio: 22 },
      { nombre: "Chaufa de Langostinos", precio: 28 },
      { nombre: "Chaufa de Pescado", precio: 25 },
    ],
  },
  {
    nombre: "Frituras",
    area: "Cocina",
    productos: [
      { nombre: "Chicharrón de Pescado", precio: 20 },
      {
        nombre: "Chicharrón de Pota",
        precio: [
          { nombre: "S/ 10", precio: 10 },
          { nombre: "S/ 18", precio: 18 },
        ],
      },
      { nombre: "Pescado Frito", precio: 25 },
      { nombre: "Chicharrón Mixto", precio: 30 },
      { nombre: "Jalea Mixta", precio: 40 },
    ],
  },
  {
    nombre: "Guarniciones",
    area: "Cocina",
    productos: [
      { nombre: "Arroz Blanco", precio: 4 },
      { nombre: "Yuca Cocinada", precio: 4 },
      { nombre: "Yuca Frita", precio: 5 },
      { nombre: "Camote", precio: 3 },
    ],
  },
  {
    nombre: "Combos",
    area: "Cocina",
    productos: [
      { nombre: "Combo Doble", precio: 25, comboCantidad: 2 },
      { nombre: "Combo Triple", precio: 38, comboCantidad: 3 },
    ],
  },
  {
    nombre: "Bebidas",
    area: "Bebidas",
    productos: [
      { nombre: "Chicha de Jora", precio: 12 },
      { nombre: "Refresco", precio: 10 },
      { nombre: "Gaseosa Personal", precio: 3 },
      { nombre: "Gaseosa 600 ml", precio: 5 },
      { nombre: "Gaseosa 1 L", precio: 9 },
      { nombre: "Gordita", precio: 6 },
      { nombre: "Cerveza Pilsen", precio: 9 },
      { nombre: "Cerveza Cristal", precio: 8 },
      { nombre: "Cerveza Cusqueña", precio: 10 },
    ],
  },
];

// Platos elegibles en ambos combos (Doble y Triple)
const OPCIONES_COMBO = [
  "Leche de Tigre",
  "Ceviche Simple",
  "Arroz con Mariscos",
  "Chaufa de Mariscos",
  "Chicharrón de Pescado",
  "Chicharrón Mixto",
];

// ---------- BORRADO ----------

// Borra todo lo que cuelga del negocio, de hijos a padres
async function borrarNegocio(tx: Tx, negocioId: string) {
  await tx.pago.deleteMany({ where: { pedido: { negocioId } } });
  await tx.pedido.deleteMany({ where: { negocioId } }); // sus items caen en cascada
  await tx.turnoCaja.deleteMany({ where: { negocioId } });
  await tx.comboOpcion.deleteMany({ where: { combo: { negocioId } } });
  await tx.varianteProducto.deleteMany({ where: { producto: { negocioId } } });
  await tx.producto.deleteMany({ where: { negocioId } });
  await tx.categoria.deleteMany({ where: { negocioId } });
  await tx.area.deleteMany({ where: { negocioId } });
  await tx.notaRapida.deleteMany({ where: { negocioId } });
  await tx.mesa.deleteMany({ where: { negocioId } });
  await tx.cliente.deleteMany({ where: { negocioId } });
  await tx.repartidor.deleteMany({ where: { negocioId } });
  await tx.usuario.deleteMany({ where: { negocioId } });
  await tx.negocio.delete({ where: { id: negocioId } });
}

// ---------- CREACIÓN ----------

async function crearNegocio(tx: Tx, usuarios: { usuario: string; nombre: string; passwordHash: string; roles: Rol[] }[]) {
  const negocio = await tx.negocio.create({
    data: {
      codigo: CODIGO_NEGOCIO,
      nombre: NOMBRE_NEGOCIO,
      direccion: "Tarapoto, Perú",
      logoUrl: LOGO_NEGOCIO,
      costoEnvioDefault: "3.00",
      precioTaper: "1.00",
      // Reparto: el primer distrito es el de por defecto
      distritos: ["Tarapoto", "Morales", "La Banda de Shilcayo"],
      region: "San Martín, Perú",
    },
  });
  const negocioId = negocio.id;

  const areas = {
    Cocina: await tx.area.create({ data: { negocioId, nombre: "Cocina", orden: 1 } }),
    Bebidas: await tx.area.create({ data: { negocioId, nombre: "Bebidas", orden: 2 } }),
  };

  await tx.usuario.createMany({ data: usuarios.map((u) => ({ negocioId, ...u })) });

  await tx.mesa.createMany({
    data: Array.from({ length: 7 }, (_, i) => ({ negocioId, nombre: `Mesa ${i + 1}`, orden: i + 1 })),
  });

  await tx.repartidor.create({ data: { negocioId, nombre: "Motorizado", telefono: "999888777" } });

  await tx.notaRapida.createMany({
    data: NOTAS_RAPIDAS.map((texto, i) => ({ negocioId, texto, orden: i + 1 })),
  });

  // Carta: categorías -> productos -> variantes
  const productoIdPorNombre = new Map<string, string>();
  const comboIds: string[] = [];

  for (const [i, cat] of CARTA.entries()) {
    const categoria = await tx.categoria.create({
      data: { negocioId, nombre: cat.nombre, orden: i + 1 },
    });

    for (const [j, p] of cat.productos.entries()) {
      const variantes: VarianteSeed[] =
        typeof p.precio === "number" ? [{ nombre: "Única", precio: p.precio }] : p.precio;

      const producto = await tx.producto.create({
        data: {
          negocioId,
          categoriaId: categoria.id,
          areaId: areas[cat.area].id,
          nombre: p.nombre,
          orden: j + 1,
          esCombo: p.comboCantidad !== undefined,
          // Tapers por unidad: bebidas 0, combos uno por plato (2 o 3), el resto 1
          tapers: cat.area === "Bebidas" ? 0 : (p.comboCantidad ?? 1),
          comboCantidad: p.comboCantidad ?? null,
          variantes: {
            create: variantes.map((v, k) => ({
              nombre: v.nombre,
              precio: v.precio.toFixed(2),
              orden: k + 1,
            })),
          },
        },
      });

      productoIdPorNombre.set(p.nombre, producto.id);
      if (p.comboCantidad !== undefined) comboIds.push(producto.id);
    }
  }

  // Opciones elegibles de cada combo
  for (const comboId of comboIds) {
    await tx.comboOpcion.createMany({
      data: OPCIONES_COMBO.map((nombre, i) => {
        const productoId = productoIdPorNombre.get(nombre);
        if (!productoId) throw new Error(`Opción de combo inexistente en la carta: ${nombre}`);
        return { comboId, productoId, orden: i + 1 };
      }),
    });
  }

  return negocio;
}

// ---------- MAIN ----------

async function main() {
  // El seed borra pedidos, pagos y turnos de caja: nunca debe correr en producción
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Seed abortado: NODE_ENV=production. Este seed borra y recrea todos los datos de " +
        `"${NOMBRE_NEGOCIO}" y solo puede ejecutarse en desarrollo.`,
    );
  }

  // El hash se calcula fuera de la transacción porque bcrypt es lento
  const usuarios = await Promise.all(
    USUARIOS.map(async ({ password, ...u }) => ({
      ...u,
      passwordHash: await bcrypt.hash(password, 10),
    })),
  );

  const negocio = await prisma.$transaction(
    async (tx) => {
      const existentes = await tx.negocio.findMany({ where: { codigo: CODIGO_NEGOCIO } });
      for (const n of existentes) await borrarNegocio(tx, n.id);
      return crearNegocio(tx, usuarios);
    },
    { timeout: 30_000 },
  );

  console.log(`Seed listo: ${negocio.nombre} (${negocio.id})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
