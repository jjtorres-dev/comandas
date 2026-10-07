// Servidor para las pruebas de punta a punta del frontend: usa su propia base
// (comandas_e2e, en el mismo contenedor que desarrollo), recién migrada y con
// el seed, y escucha en otro puerto. Las pruebas nunca tocan la base de
// desarrollo. Lo levanta Playwright (frontend/playwright.config.ts).
import "dotenv/config";
import { execSync } from "node:child_process";
import pg from "pg";

const BASE = "comandas_e2e";
const PUERTO = process.env.PUERTO_E2E ?? "3100";

const url = new URL(process.env.DATABASE_URL ?? "");
url.pathname = `/${BASE}`;
// Las variables ya definidas mandan sobre el .env: todo lo que sigue usa la base de pruebas
Object.assign(process.env, { DATABASE_URL: url.toString(), PORT: PUERTO, NODE_ENV: "development" });

const admin = new URL(url);
admin.pathname = "/postgres";
const cliente = new pg.Client({ connectionString: admin.toString() });
await cliente.connect();
try {
  const existe = await cliente.query("SELECT 1 FROM pg_database WHERE datname = $1", [BASE]);
  if (existe.rowCount === 0) await cliente.query(`CREATE DATABASE "${BASE}"`);
} finally {
  await cliente.end();
}

// Cada corrida parte de los mismos datos: migraciones al día y seed completo
execSync("npx prisma migrate deploy", { env: process.env, stdio: "inherit" });
execSync("npx prisma db seed", { env: process.env, stdio: "inherit" });

await import("../src/server");
