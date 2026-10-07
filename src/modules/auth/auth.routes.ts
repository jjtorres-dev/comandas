import { Router } from "express";
import { MemoryStore, rateLimit } from "express-rate-limit";
import { ErrorApp } from "../../lib/errores";
import * as controlador from "./auth.controller";

export const rutasAuth = Router();

// Exportado para que las pruebas puedan reiniciar el contador
export const intentosDeLogin = new MemoryStore();

// 5 intentos fallidos por minuto por IP (los logins correctos no cuentan)
const limiteLogin = rateLimit({
  windowMs: 60_000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: intentosDeLogin,
  handler: (_req, _res, next) => {
    next(new ErrorApp(429, "DEMASIADOS_INTENTOS", "Demasiados intentos. Espera un minuto y vuelve a probar"));
  },
});

rutasAuth.post("/login", limiteLogin, controlador.login);
