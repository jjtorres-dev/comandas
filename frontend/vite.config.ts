import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// Rutas que atiende el backend. En desarrollo Vite las reenvía, así el celular
// solo necesita llegar al puerto 5173 y no hay CORS de por medio.
const RUTAS_BACKEND = ["/api", "/uploads"];

export default defineConfig(({ mode }) => {
  const entorno = loadEnv(mode, process.cwd(), "");
  const backend = entorno.PROXY_BACKEND || "http://localhost:3000";

  const proxy = {
    ...Object.fromEntries(RUTAS_BACKEND.map((ruta) => [ruta, { target: backend }])),
    "/socket.io": { target: backend, ws: true },
  };

  return {
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
