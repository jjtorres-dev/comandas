import { randomUUID } from "node:crypto";
import bcrypt from "bcrypt";
import request from "supertest";
import { app } from "../src/app";
import { Rol } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";
import { firmarToken } from "../src/middlewares/auth";

export { app, prisma };

export const CLAVE = "clave123";

// Vacía todas las tablas. Se niega a correr fuera de una base "_test".
export async function limpiarBase() {
  const [{ base }] = await prisma.$queryRaw<{ base: string }[]>`SELECT current_database() AS base`;
  if (!base.endsWith("_test")) throw new Error(`limpiarBase() solo corre en bases "_test" (actual: ${base})`);

  const tablas = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const lista = tablas.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE ${lista} CASCADE`);
}

// Negocio mínimo con carta, mesas, un repartidor y un usuario por rol
// ("mozo", "cocina" y "admin", los mismos nombres en todos los negocios).
// Envío por defecto S/ 3.00 y taper a S/ 1.00, como en el schema.
export async function crearNegocio(nombre: string, codigo: string, logoUrl?: string) {
  const negocio = await prisma.negocio.create({ data: { nombre, codigo, logoUrl } });
  const negocioId = negocio.id;

  const cocina = await prisma.area.create({ data: { negocioId, nombre: "Cocina", orden: 1 } });
  const bebidas = await prisma.area.create({ data: { negocioId, nombre: "Bebidas", orden: 2 } });
  const categoria = await prisma.categoria.create({ data: { negocioId, nombre: "Carta", orden: 1 } });

  let orden = 0;
  const producto = (
    nombreProducto: string,
    areaId: string,
    variantes: [string, number][],
    extra: { comboCantidad?: number; tapers?: number } = {},
  ) =>
    prisma.producto.create({
      data: {
        negocioId,
        categoriaId: categoria.id,
        areaId,
        nombre: nombreProducto,
        orden: ++orden,
        esCombo: extra.comboCantidad !== undefined,
        comboCantidad: extra.comboCantidad,
        tapers: extra.tapers, // sin valor: 1, el default del schema
        variantes: { create: variantes.map(([n, precio], i) => ({ nombre: n, precio, orden: i })) },
      },
      include: { variantes: { orderBy: { orden: "asc" } } },
    });

  const ceviche = await producto("Ceviche Simple", cocina.id, [["Única", 20]]);
  const leche = await producto("Leche de Tigre", cocina.id, [["Única", 12]]);
  const arroz = await producto("Arroz con Mariscos", cocina.id, [["Única", 22]]);
  const pota = await producto("Chicharrón de Pota", cocina.id, [["S/ 10", 10], ["S/ 18", 18]]);
  const gaseosa = await producto("Gaseosa Personal", bebidas.id, [["Única", 3]], { tapers: 0 });
  const combo = await producto("Combo Doble", cocina.id, [["Única", 25]], { comboCantidad: 2, tapers: 2 });

  // El arroz queda fuera de las opciones del combo a propósito
  await prisma.comboOpcion.createMany({
    data: [ceviche, leche].map((p, i) => ({ comboId: combo.id, productoId: p.id, orden: i })),
  });

  const mesas = [];
  for (let i = 1; i <= 3; i++) {
    mesas.push(await prisma.mesa.create({ data: { negocioId, nombre: `Mesa ${i}`, orden: i } }));
  }

  const repartidor = await prisma.repartidor.create({ data: { negocioId, nombre: "Motorizado" } });

  const passwordHash = await bcrypt.hash(CLAVE, 4);
  const roles = { mozo: Rol.MOZO, cocina: Rol.LOCAL, admin: Rol.ADMIN };
  for (const [usuario, rol] of Object.entries(roles)) {
    await prisma.usuario.create({
      data: { negocioId, nombre: usuario, usuario, passwordHash, roles: [rol] },
    });
  }

  return {
    negocio,
    repartidor,
    areas: { cocina, bebidas },
    mesas,
    productos: { ceviche, leche, arroz, pota, gaseosa, combo },
    // Atajos a las variantes más usadas
    v: {
      ceviche: ceviche.variantes[0].id,
      leche: leche.variantes[0].id,
      pota10: pota.variantes[0].id,
      pota18: pota.variantes[1].id,
      gaseosa: gaseosa.variantes[0].id,
      combo: combo.variantes[0].id,
    },
  };
}

export type NegocioDePrueba = Awaited<ReturnType<typeof crearNegocio>>;

// Token de un usuario del negocio, firmado directamente (sin pasar por el login,
// que tiene límite de intentos)
export async function tokenDe(n: NegocioDePrueba, usuario: "mozo" | "cocina" | "admin"): Promise<string> {
  const u = await prisma.usuario.findUniqueOrThrow({
    where: { negocioId_usuario: { negocioId: n.negocio.id, usuario } },
  });
  return firmarToken({ usuarioId: u.id, negocioId: u.negocioId, roles: u.roles });
}

type ItemDePrueba = { varianteId: string; cantidad?: number; notas?: string[]; componentes?: string[] };

// POST /api/pedidos con valores por defecto razonables
export function crearPedido(
  token: string,
  datos: {
    tipo?: string;
    mesaId?: string;
    items: ItemDePrueba[];
    nota?: string;
    idCliente?: string;
    cliente?: { telefono?: string; nombre?: string; direccion?: string; referencia?: string };
    costoEnvio?: number;
    cantidadTapers?: number;
  },
) {
  const { mesaId, items, ...resto } = datos;
  return request(app)
    .post("/api/pedidos")
    .set("Authorization", `Bearer ${token}`)
    .send({
      ...resto,
      tipo: datos.tipo ?? (mesaId ? "MESA" : "PARA_LLEVAR"),
      mesaId,
      idCliente: datos.idCliente ?? randomUUID(),
      items: items.map((i) => ({ cantidad: 1, notas: [], ...i })),
    });
}

export const conToken = (token: string) => ({ Authorization: `Bearer ${token}` });
