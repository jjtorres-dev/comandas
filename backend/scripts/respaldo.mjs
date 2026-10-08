// npm run respaldo
// Copia completa de la base de DATABASE_URL a respaldos/comandas-AAAA-MM-DD-HHMM.dump
// (formato de pg_dump, comprimido). No modifica nada en la base.
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { correr, sinClave, urlDeLaBase, urlLimpia, versionDelServidor } from "./pg.mjs";

const url = urlDeLaBase();
const carpeta = path.resolve(process.env.CARPETA_RESPALDOS ?? fileURLToPath(new URL("../respaldos", import.meta.url)));
mkdirSync(carpeta, { recursive: true });

// La fecha del nombre es la del negocio (Lima), no la del equipo
const partes = Object.fromEntries(
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    .formatToParts(new Date())
    .map((p) => [p.type, p.value]),
);
const archivo = `comandas-${partes.year}-${partes.month}-${partes.day}-${partes.hour}${partes.minute}.dump`;

const version = await versionDelServidor(url).catch((error) => {
  console.error(`No se pudo conectar a la base: ${error.message}`);
  process.exit(1);
});
console.log(`Respaldando ${sinClave(url)} (PostgreSQL ${version})`);
const estado = correr("pg_dump", version, carpeta, (dir) => ["--format=custom", "--no-owner", "--no-privileges", `--file=${dir}/${archivo}`, urlLimpia(url)]);
if (estado !== 0) {
  console.error("El respaldo falló. No se guardó nada utilizable.");
  process.exit(1);
}

const destino = path.join(carpeta, archivo);
const kb = Math.round(statSync(destino).size / 1024);
console.log(`Respaldo listo: ${destino} (${kb} kB)`);
console.log("Guárdalo fuera de este equipo (Drive, un USB): contiene todos los datos del negocio.");
