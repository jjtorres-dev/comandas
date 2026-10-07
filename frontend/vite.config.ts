import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createLogger, defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Rutas que atiende el backend. En desarrollo Vite las reenvía, así el celular
// solo necesita llegar al puerto 5173 y no hay CORS de por medio.
const RUTAS_BACKEND = ["/api", "/uploads"];

// Cuando el navegador cierra un socket (logout, recarga), el proxy de WebSocket
// ve un ECONNRESET o EPIPE y Vite lo registra como error. Es un cierre normal:
// se calla solo eso, y cualquier otro error del proxy se sigue viendo.
const CIERRES_NORMALES = new Set(["ECONNRESET", "EPIPE"]);
const registro = createLogger();
const registrarError = registro.error;
registro.error = (mensaje, opciones) => {
  const codigo = (opciones?.error as NodeJS.ErrnoException | null | undefined)?.code;
  if (mensaje.includes("ws proxy") && codigo && CIERRES_NORMALES.has(codigo)) return;
  registrarError(mensaje, opciones);
};

export default defineConfig(({ mode }) => {
  const entorno = loadEnv(mode, process.cwd(), "");
  const backend = entorno.PROXY_BACKEND || "http://localhost:3000";

  const proxy = {
    ...Object.fromEntries(RUTAS_BACKEND.map((ruta) => [ruta, { target: backend }])),
    "/socket.io": { target: backend, ws: true },
  };

  return {
    customLogger: registro,
    // Las pruebas E2E levantan su propio Vite con otra carpeta de caché
    cacheDir: entorno.CACHE_VITE || undefined,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg", "apple-touch-icon.png"],
        manifest: {
          name: "Comandas",
          short_name: "Comandas",
          description: "Comandas para restaurantes: pedidos, cocina y caja",
          lang: "es",
          start_url: "/",
          scope: "/",
          display: "standalone",
          orientation: "portrait",
          theme_color: "#0BB2AC",
          background_color: "#EFF5F6",
          icons: [
            { src: "pwa-192.png", sizes: "192x192", type: "image/png" },
            { src: "pwa-512.png", sizes: "512x512", type: "image/png" },
            { src: "pwa-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          // La API, los logos y el tiempo real nunca salen de la caché
          navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//, /^\/socket\.io\//],
        },
      }),
    ],
    // host: true expone el servidor en la red local para probar desde el celular
    server: { host: true, port: 5173, strictPort: true, proxy },
    preview: { host: true, port: 5173, strictPort: true, proxy },
  };
});
