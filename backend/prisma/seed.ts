// ============================================================
//  Seed de desarrollo: Cevichería Valentina (Tarapoto, Perú)
//  Idempotente: borra todos los datos de ese negocio (incluidos
//  pedidos, pagos y turnos de caja) y los vuelve a crear.
// ============================================================

import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Rol } from "../src/generated/prisma/client";
import { CODIGO_NEGOCIO, crearCarta, crearMesas, crearMotorizado, crearNegocio, crearNotas, NOMBRE_NEGOCIO } from "../src/seed/valentina";

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

async function crearTodo(tx: Tx, usuarios: { usuario: string; nombre: string; passwordHash: string; roles: Rol[] }[]) {
  const negocio = await crearNegocio(tx);
  await tx.usuario.createMany({ data: usuarios.map((u) => ({ negocioId: negocio.id, ...u })) });
  await crearMesas(tx, negocio.id);
  await crearMotorizado(tx, negocio.id);
  await crearNotas(tx, negocio.id);
  await crearCarta(tx, negocio.id);
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
      return crearTodo(tx, usuarios);
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
