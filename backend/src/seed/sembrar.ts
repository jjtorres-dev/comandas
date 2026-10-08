// npm run seed:produccion
import { prisma } from "../lib/prisma.js";
import { sembrarProduccion } from "./produccion.js";
import { CODIGO_NEGOCIO } from "./valentina.js";

try {
  const { hecho, yaEstaba } = await sembrarProduccion(process.env);
  console.log(`Seed de producción listo (código del negocio: ${CODIGO_NEGOCIO}).`);
  console.log(hecho.length > 0 ? `  Se creó: ${hecho.join(", ")}.` : "  No se creó nada: ya estaba todo.");
  if (yaEstaba.length > 0) console.log(`  Ya existía y no se tocó: ${yaEstaba.join(", ")}.`);
} catch (error) {
  // Sin traza: lo que importa es el mensaje
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
