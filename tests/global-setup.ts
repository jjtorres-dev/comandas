import { execSync } from "node:child_process";
import pg from "pg";

// Crea la base de pruebas si no existe y le aplica las migraciones
export default async function setup() {
  const urlTest = new URL(process.env.DATABASE_URL!);
  const base = urlTest.pathname.slice(1);
  if (!base.endsWith("_test")) {
    throw new Error(`La base de pruebas debe terminar en "_test" (recibido: "${base}")`);
  }

  const urlAdmin = new URL(urlTest);
  urlAdmin.pathname = "/postgres";
  const admin = new pg.Client({ connectionString: urlAdmin.toString() });
  await admin.connect();
  try {
    const existe = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [base]);
    if (existe.rowCount === 0) await admin.query(`CREATE DATABASE "${base}"`);
  } finally {
    await admin.end();
  }

  execSync("npx prisma migrate deploy", { env: process.env, stdio: "pipe" });
}
