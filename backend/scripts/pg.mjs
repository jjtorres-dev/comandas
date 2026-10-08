// Común a respaldo.mjs y restaurar.mjs: corre pg_dump / pg_restore de la misma
// versión que el servidor, instalados en el equipo o desde la imagen oficial
// de PostgreSQL (Podman o Docker).
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import pg from "pg";

const existe = (comando) => spawnSync(comando, ["--version"], { stdio: "ignore" }).status === 0;

// "pg_dump (PostgreSQL) 16.4" -> 16
function versionLocal(herramienta) {
  const salida = spawnSync(herramienta, ["--version"], { encoding: "utf8" });
  return salida.status === 0 ? Number(/(\d+)(\.\d+)?\s*$/.exec(salida.stdout.trim())?.[1]) : null;
}

// Versión mayor del servidor (16, 17…). pg_dump tiene que ser de esa misma
// versión: uno más viejo se niega a respaldar y uno más nuevo puede dejar un
// archivo que el servidor no sabe restaurar
export async function versionDelServidor(url) {
  const cliente = new pg.Client({ connectionString: urlLimpia(url) });
  await cliente.connect();
  try {
    const { rows } = await cliente.query("SHOW server_version_num");
    return Math.floor(Number(rows[0].server_version_num) / 10000);
  } finally {
    await cliente.end();
  }
}

// DATABASE_URL del entorno o, si no está, del .env de backend/
export function urlDeLaBase() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const env = new URL("../.env", import.meta.url);
  const linea = existsSync(env) ? readFileSync(env, "utf8").split("\n").find((l) => l.startsWith("DATABASE_URL=")) : undefined;
  const url = linea?.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
  if (!url) {
    console.error("Falta DATABASE_URL. Ejemplo:\n  DATABASE_URL='postgresql://usuario:clave@host:puerto/base' npm run respaldo");
    process.exit(1);
  }
  return url;
}

// pg_dump y pg_restore no entienden los parámetros de Prisma (?schema=public)
export function urlLimpia(url) {
  const limpia = new URL(url);
  limpia.search = "";
  return limpia.toString();
}

// Para mostrar en pantalla sin la contraseña
export function sinClave(url) {
  const visible = new URL(url);
  if (visible.password) visible.password = "****";
  visible.search = "";
  return visible.toString();
}

// Corre una herramienta de PostgreSQL de la versión `version`, con la carpeta
// `carpeta` a mano (en el contenedor se monta en /respaldos). `args` recibe esa
// ruta ya resuelta. Usa la instalada en el equipo si es de esa versión; si no,
// la de la imagen oficial de PostgreSQL, con Podman o Docker.
export function correr(herramienta, version, carpeta, args) {
  if (versionLocal(herramienta) === version) {
    return spawnSync(herramienta, args(carpeta), { stdio: "inherit" }).status ?? 1;
  }
  const motor = ["podman", "docker"].find(existe);
  if (!motor) {
    console.error(`Hace falta ${herramienta} de PostgreSQL ${version} (paquete postgresql-client), o tener Podman o Docker para correrlo desde su imagen.`);
    return 1;
  }
  const imagen = `docker.io/library/postgres:${version}-alpine`;
  // --network host: para llegar también a una base en localhost
  return spawnSync(motor, ["run", "--rm", "--network", "host", "-v", `${carpeta}:/respaldos:Z`, imagen, herramienta, ...args("/respaldos")], { stdio: "inherit" }).status ?? 1;
}
