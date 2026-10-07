import { defineConfig } from "@playwright/test";

// Pruebas de punta a punta contra el entorno de desarrollo (base de datos con
// el seed, backend en :3000 y Vite en :5173). Si ya están levantados, se
// reutilizan; si no, `npm run dev` de la raíz los levanta.
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:5173",
    // El celular del mozo: Android en vertical
    viewport: { width: 412, height: 915 },
    hasTouch: true,
    isMobile: true,
    locale: "es-PE",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm --prefix .. run dev",
    url: "http://localhost:5173/api/salud",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
