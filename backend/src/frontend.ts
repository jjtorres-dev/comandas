import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";

// Donde queda el build del frontend visto desde src/ (o dist/) del backend
export const FRONTEND_POR_DEFECTO = fileURLToPath(new URL("../../frontend/dist", import.meta.url));

const SIN_CACHE = "no-cache";

// Producción: un solo servicio. El backend sirve el build del frontend, y
// cualquier ruta de la aplicación (/mozo/mesas, /local/caja…) responde
// index.html para que React Router la resuelva.
export function servirFrontend(app: Express, carpeta: string) {
  const inicio = path.join(carpeta, "index.html");
  if (!existsSync(inicio)) {
    throw new Error(`No está el build del frontend en ${carpeta}. Corre "npm run build" en frontend/ o define FRONTEND_DIST`);
  }

  app.use(
    express.static(carpeta, {
      index: false,
      setHeaders(res, archivo) {
        // Vite pone un hash en el nombre de lo que hay en assets/: nunca cambia.
        // Lo demás (index.html, sw.js, el manifiesto) se comprueba siempre, o
        // los equipos se quedarían con una versión vieja
        const conHash = archivo.includes(`${path.sep}assets${path.sep}`);
        res.setHeader("Cache-Control", conHash ? "public, max-age=31536000, immutable" : SIN_CACHE);
      },
    }),
  );

  app.use((req, res, next) => {
    const esPagina = (req.method === "GET" || req.method === "HEAD") && !req.path.startsWith("/api/") && !req.path.startsWith("/socket.io/");
    // Un archivo que no existe (/logo.png) es un 404, no la aplicación
    if (!esPagina || path.extname(req.path) !== "") return next();
    res.setHeader("Cache-Control", SIN_CACHE);
    res.sendFile(inicio);
  });
}
