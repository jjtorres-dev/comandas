// npm run restaurar -- respaldos/comandas-2026-10-07-2130.dump
// Reemplaza TODO el contenido de la base de DATABASE_URL por el del respaldo.
// Pide escribir el nombre de la base para confirmar (o CONFIRMAR=<nombre de la base>).
import { existsSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { correr, sinClave, urlDeLaBase, urlLimpia, versionDelServidor } from "./pg.mjs";

const archivo = process.argv[2];
if (!archivo || !existsSync(archivo)) {
  console.error("Indica el respaldo a restaurar:\n  npm run restaurar -- respaldos/comandas-AAAA-MM-DD-HHMM.dump");
  process.exit(1);
}

const url = urlDeLaBase();
const base = decodeURIComponent(new URL(url).pathname.slice(1));

console.log(`Vas a REEMPLAZAR todo lo que hay en ${sinClave(url)}`);
console.log(`con el respaldo ${archivo}. Lo que haya ahora en esa base se pierde.`);

let respuesta = process.env.CONFIRMAR;
if (respuesta === undefined) {
  const consola = createInterface({ input: process.stdin, output: process.stdout });
  respuesta = await consola.question(`Para continuar escribe el nombre de la base (${base}): `);
  consola.close();
}
if (respuesta.trim() !== base) {
  console.error("No coincide. No se cambió nada.");
  process.exit(1);
}

const version = await versionDelServidor(url).catch((error) => {
  console.error(`No se pudo conectar a la base: ${error.message}`);
  process.exit(1);
});
const completo = path.resolve(archivo);
// --clean --if-exists: borra cada tabla antes de recrearla. --single-transaction: o entra todo o no cambia nada
const estado = correr("pg_restore", version, path.dirname(completo), (dir) => [
  "--clean",
  "--if-exists",
  "--no-owner",
  "--no-privileges",
  "--single-transaction",
  `--dbname=${urlLimpia(url)}`,
  `${dir}/${path.basename(completo)}`,
]);
if (estado !== 0) {
  console.error("La restauración falló. Al ir en una sola transacción, la base quedó como estaba.");
  process.exit(1);
}
console.log("Restauración lista. Reinicia el servicio para que todos vuelvan a iniciar sesión con los datos restaurados.");
