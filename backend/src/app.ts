import cors from "cors";
import express from "express";
import helmet from "helmet";
import { z } from "zod";
import { opcionesCors } from "./config/cors.js";
import { env } from "./config/env.js";
import { FRONTEND_POR_DEFECTO, servirFrontend } from "./frontend.js";
import { prisma } from "./lib/prisma.js";
import { registrarPeticiones } from "./lib/registro.js";
import { manejarErrores, rutaNoEncontrada } from "./middlewares/errores.js";
import { rutasAdmin } from "./modules/admin/admin.routes.js";
import { rutasAuth } from "./modules/auth/auth.routes.js";
import { rutasCaja } from "./modules/caja/caja.routes.js";
import { rutasCarta } from "./modules/carta/carta.routes.js";
import { rutasClientes } from "./modules/clientes/clientes.routes.js";
import { rutasMesas } from "./modules/mesas/mesas.routes.js";
import { rutasNegocios } from "./modules/negocios/negocios.routes.js";
import { rutasPagos } from "./modules/pagos/pagos.routes.js";
import { rutasPedidos } from "./modules/pedidos/pedidos.routes.js";
import { rutasRepartidores } from "./modules/repartidores/repartidores.routes.js";

// Mensajes de validación en español
z.config(z.locales.es());

export const app = express();

app.disable("x-powered-by");
// Detrás de un proxy (Railway), req.ip debe ser la del cliente y no la del proxy
if (env.TRUST_PROXY !== undefined) app.set("trust proxy", env.TRUST_PROXY);
app.use(registrarPeticiones);
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // motion y sonner escriben estilos en línea; no hay hojas de estilo de terceros
        styleSrc: ["'self'", "'unsafe-inline'"],
        // La fuente viene con la aplicación
        fontSrc: ["'self'"],
        // El logo sale de /api/negocios/<codigo>/logo, o de una URL https si el negocio la usa
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        // La API y Socket.IO (también por websocket), siempre en este mismo origen
        connectSrc: ["'self'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        // wa.me y Google Maps son enlaces que se abren en otra pestaña: la CSP no los restringe
      },
    },
    // En desarrollo el frontend (Vite, otro puerto) pide el logo a este servidor
    crossOriginResourcePolicy: { policy: "same-site" },
  }),
);
// En producción el frontend y la API comparten origen: no hay CORS que abrir
if (env.NODE_ENV !== "production") app.use(cors(opcionesCors));
// Límite de tamaño de los cuerpos. El logo (hasta 1 MB) tiene el suyo en su ruta
app.use(express.json({ limit: "100kb" }));

// Nada de la API se guarda en caché (el logo fija la suya)
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// Railway la consulta para saber si el servicio está sano: comprueba también la base
app.get("/api/salud", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch (error) {
    req.log.error({ err: error }, "La base de datos no responde");
    res.status(503).json({ ok: false, error: { codigo: "BASE_NO_DISPONIBLE", mensaje: "El servidor no puede conectarse a la base de datos" } });
  }
});

app.use("/api/auth", rutasAuth);
// Administración: solo el dueño (ADMIN)
app.use("/api/admin", rutasAdmin);
app.use("/api/negocios", rutasNegocios);
app.use("/api/carta", rutasCarta);
app.use("/api/mesas", rutasMesas);
app.use("/api/clientes", rutasClientes);
app.use("/api/repartidores", rutasRepartidores);
app.use("/api/caja", rutasCaja);
// Cuenta, pagos y nota de venta cuelgan de /api/pedidos/:id
app.use("/api/pedidos", rutasPedidos, rutasPagos);

// Un solo servicio: en producción este mismo servidor entrega la aplicación web
if (env.NODE_ENV === "production") servirFrontend(app, env.FRONTEND_DIST ?? FRONTEND_POR_DEFECTO);

app.use(rutaNoEncontrada);
app.use(manejarErrores);
