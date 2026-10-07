import "dotenv/config";
import { defineConfig } from "vitest/config";

// Las pruebas corren contra comandas_test (mismo contenedor que desarrollo).
// Se puede apuntar a otra base con DATABASE_URL_TEST.
function urlDePruebas(): string {
  if (process.env.DATABASE_URL_TEST) return process.env.DATABASE_URL_TEST;
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.pathname = "/comandas_test";
  return url.toString();
}

const entorno = {
  NODE_ENV: "test",
  DATABASE_URL: urlDePruebas(),
  JWT_SECRET: "secreto-solo-para-pruebas-0123456789abcdef",
};

// El globalSetup corre en este mismo proceso y necesita la misma URL
Object.assign(process.env, entorno);

export default defineConfig({
  test: {
    env: entorno,
    include: ["tests/**/*.test.ts"],
    globalSetup: "tests/global-setup.ts",
    // Todos los archivos comparten una sola base: no pueden correr en paralelo
    fileParallelism: false,
  },
});
