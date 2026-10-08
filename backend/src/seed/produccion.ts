// ============================================================
//  Seed de producción: Cevichería Valentina
//  NUNCA borra ni pisa nada. Crea solo lo que falta, así que se
//  puede correr las veces que haga falta (npm run seed:produccion,
//  que ejecuta sembrar.ts).
// ============================================================
import bcrypt from "bcrypt";
import { z } from "zod";
import { Rol } from "../generated/prisma/client.js";
import { prisma } from "../lib/prisma.js";
import { CODIGO_NEGOCIO, crearCarta, crearMesas, crearMotorizado, crearNegocio, crearNotas, datosDelLogo, DISTRITOS, MOTORIZADO } from "./valentina.js";

// El primer usuario: el dueño, que también cocina y cobra. Los demás los crea él desde /admin
const esquemaAdmin = z.object({
  ADMIN_INICIAL_NOMBRE: z.string({ error: "falta" }).trim().min(1, "falta").max(80),
  ADMIN_INICIAL_USUARIO: z
    .string({ error: "falta" })
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,30}$/, "lleva de 3 a 30 letras minúsculas o números, sin espacios"),
  ADMIN_INICIAL_PASSWORD: z.string({ error: "falta" }).min(8, "necesita al menos 8 caracteres").max(72),
});

// Devuelve qué creó y qué encontró ya hecho
export async function sembrarProduccion(variables: NodeJS.ProcessEnv): Promise<{ hecho: string[]; yaEstaba: string[] }> {
  const hecho: string[] = [];
  const yaEstaba: string[] = [];
  const anotar = (creado: boolean, que: string) => (creado ? hecho : yaEstaba).push(que);

  const existente = await prisma.negocio.findUnique({ where: { codigo: CODIGO_NEGOCIO }, select: { id: true } });
  const sinUsuarios = !existente || (await prisma.usuario.count({ where: { negocioId: existente.id } })) === 0;

  // Las variables del usuario inicial solo hacen falta si hay que crearlo. Se
  // revisan antes de tocar la base, y el hash se calcula fuera de la transacción
  let admin: { nombre: string; usuario: string; passwordHash: string } | null = null;
  if (sinUsuarios) {
    const leido = esquemaAdmin.safeParse(variables);
    if (!leido.success) {
      const detalle = leido.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
      throw new Error(`El negocio todavía no tiene usuarios y faltan los datos del primero:\n${detalle}`);
    }
    const { ADMIN_INICIAL_NOMBRE: nombre, ADMIN_INICIAL_USUARIO: usuario, ADMIN_INICIAL_PASSWORD: password } = leido.data;
    admin = { nombre, usuario, passwordHash: await bcrypt.hash(password, 10) };
  }

  await prisma.$transaction(
    async (tx) => {
      // Si dos seeds corren a la vez, el segundo espera aquí y ya encuentra todo creado
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('seed-produccion'))`;

      let negocio = await tx.negocio.findUnique({ where: { codigo: CODIGO_NEGOCIO }, select: { id: true, logoUrl: true, distritos: true } });
      anotar(!negocio, "el negocio");
      if (!negocio) negocio = { ...(await crearNegocio(tx)), logoUrl: "recién creado", distritos: DISTRITOS };
      const negocioId = negocio.id;

      // Cada cosa solo si no hay ninguna: lo que el dueño ya cambió no se toca
      const falta = async (cuantos: Promise<number>, que: string, crear: () => Promise<unknown>) => {
        const vacio = (await cuantos) === 0;
        if (vacio) await crear();
        anotar(vacio, que);
      };

      if (existente) {
        const sinLogo = negocio.logoUrl === null;
        if (sinLogo) await tx.negocio.update({ where: { id: negocioId }, data: datosDelLogo() });
        anotar(sinLogo, "el logo");
        const sinDistritos = negocio.distritos.length === 0;
        if (sinDistritos) await tx.negocio.update({ where: { id: negocioId }, data: { distritos: DISTRITOS } });
        anotar(sinDistritos, "los distritos");
      }

      await falta(tx.categoria.count({ where: { negocioId } }), "la carta", () => crearCarta(tx, negocioId));
      await falta(tx.mesa.count({ where: { negocioId } }), "las mesas", () => crearMesas(tx, negocioId));
      await falta(tx.notaRapida.count({ where: { negocioId } }), "las notas rápidas", () => crearNotas(tx, negocioId));
      await falta(tx.repartidor.count({ where: { negocioId, nombre: MOTORIZADO.nombre } }), `el motorizado ${MOTORIZADO.nombre}`, () => crearMotorizado(tx, negocioId));

      const usuarios = await tx.usuario.count({ where: { negocioId } });
      if (usuarios === 0 && admin) {
        await tx.usuario.create({ data: { negocioId, ...admin, roles: [Rol.ADMIN, Rol.LOCAL] } });
        hecho.push(`el usuario inicial "${admin.usuario}" (dueño, cocina y caja)`);
      } else {
        yaEstaba.push("los usuarios (no se crea ni se cambia ninguno)");
      }
    },
    { timeout: 60_000 },
  );

  return { hecho, yaEstaba };
}
