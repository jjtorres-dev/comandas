import { defineConfig } from "vitest/config";

// Pruebas unitarias de las funciones puras de src/. Las de punta a punta
// (e2e/, Playwright) no entran aquí.
export default defineConfig({
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
