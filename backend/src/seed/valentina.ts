// Los datos de la Cevichería Valentina (Tarapoto, Perú) y cómo se crean. Los
// usan el seed de desarrollo (prisma/seed.ts, que borra y recrea todo) y el de
// producción (src/seed/produccion.ts, que solo agrega lo que falta).
import { readFileSync } from "node:fs";
import type { Prisma } from "../generated/prisma/client.js";

type Tx = Prisma.TransactionClient;

export const NOMBRE_NEGOCIO = "Cevichería Valentina";
export const CODIGO_NEGOCIO = "valentina"; // con este código se inicia sesión

// El logo se guarda en la base de datos; lo sirve GET /api/negocios/<codigo>/logo.
// La ruta vale igual desde src/seed y desde dist/seed.
const leerLogo = () => readFileSync(new URL("../../../design-ref/logo.png", import.meta.url));

export const datosDelLogo = () => ({
  logo: new Uint8Array(leerLogo()),
  logoTipo: "image/png",
  logoUrl: `/api/negocios/${CODIGO_NEGOCIO}/logo?v=1`,
});

// Reparto: el primer distrito es el de por defecto
export const DISTRITOS = ["Tarapoto", "Morales", "La Banda de Shilcayo"];
export const MESAS = 7;
export const MOTORIZADO = { nombre: "José Falcón", telefono: "916386642" };

export const NOTAS_RAPIDAS = [
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

// ---------- CREACIÓN ----------

export const crearNegocio = (tx: Tx) =>
  tx.negocio.create({
    data: {
      codigo: CODIGO_NEGOCIO,
      nombre: NOMBRE_NEGOCIO,
      direccion: "Tarapoto, Perú",
      ...datosDelLogo(),
      costoEnvioDefault: "3.00",
      precioTaper: "1.00",
      distritos: DISTRITOS,
      region: "San Martín, Perú",
    },
    select: { id: true, nombre: true },
  });

export const crearMesas = (tx: Tx, negocioId: string) =>
  tx.mesa.createMany({ data: Array.from({ length: MESAS }, (_, i) => ({ negocioId, nombre: `Mesa ${i + 1}`, orden: i + 1 })) });

export const crearMotorizado = (tx: Tx, negocioId: string) => tx.repartidor.create({ data: { negocioId, ...MOTORIZADO } });

export const crearNotas = (tx: Tx, negocioId: string) =>
  tx.notaRapida.createMany({ data: NOTAS_RAPIDAS.map((texto, i) => ({ negocioId, texto, orden: i + 1 })) });

// Las áreas de preparación y la carta completa: categorías, platos, precios y combos
export async function crearCarta(tx: Tx, negocioId: string) {
  // Si el área ya existe se reutiliza: nunca quedan dos "Cocina"
  const area = async (nombre: string, orden: number) =>
    (await tx.area.findFirst({ where: { negocioId, nombre } })) ?? (await tx.area.create({ data: { negocioId, nombre, orden } }));
  const areas = { Cocina: await area("Cocina", 1), Bebidas: await area("Bebidas", 2) };

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
}
