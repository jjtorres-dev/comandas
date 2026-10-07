import { defineConfig } from "@playwright/test";

// Pruebas de punta a punta. No tocan la base de desarrollo: Playwright levanta
// su propio backend (puerto 3100, base comandas_e2e recién sembrada) y su
// propio Vite (puerto 5183) apuntando a él. Solo hace falta el contenedor de
// Postgres (`docker compose up -d` en la raíz).
const BACKEND = "http://localhost:3100";
const FRONTEND = "http://localhost:5183";

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: FRONTEND,
    // El celular del mozo: Android en vertical
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    isMobile: true,
    locale: "es-PE",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      // Crea la base si falta, aplica migraciones, corre el seed y arranca la API
      command: "npm --prefix ../backend run e2e:servidor",
      url: `${BACKEND}/api/salud`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "npx vite --port 5183 --strictPort",
      url: FRONTEND,
      reuseExistingServer: false,
      timeout: 60_000,
      // Otra carpeta de caché: no se pisa con el Vite de desarrollo si está abierto
      env: { PROXY_BACKEND: BACKEND, CACHE_VITE: "node_modules/.vite-e2e" },
    },
  ],
});
