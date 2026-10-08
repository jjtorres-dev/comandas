import { Router } from "express";
import { MemoryStore, rateLimit } from "express-rate-limit";
import { ErrorApp } from "../../lib/errores.js";
import * as controlador from "./negocios.controller.js";

export const rutasNegocios = Router();

// Exportado para que las pruebas puedan reiniciar el contador
export const consultasDeNegocio = new MemoryStore();

// 30 consultas por minuto por IP: sobra para el login y frena a quien quiera
// adivinar códigos de negocio
const limitePublico = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: consultasDeNegocio,
  handler: (_req, _res, next) => {
    next(new ErrorApp(429, "DEMASIADOS_INTENTOS", "Demasiadas consultas. Espera un minuto y vuelve a probar"));
  },
});

// Exportado para que las pruebas puedan reiniciar el contador
export const consultasDeLogo = new MemoryStore();

// El logo sale de la base de datos. El navegador lo guarda un día, así que un
// equipo lo pide muy pocas veces: 60 por minuto por IP sobra para un local
// entero detrás del mismo wifi y frena a quien quiera cargar la base
const limiteLogo = rateLimit({
  windowMs: 60_000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: consultasDeLogo,
  handler: (_req, _res, next) => {
    next(new ErrorApp(429, "DEMASIADOS_INTENTOS", "Demasiadas consultas. Espera un minuto y vuelve a probar"));
  },
});

rutasNegocios.get("/:codigo/publico", limitePublico, controlador.publico);
rutasNegocios.get("/:codigo/logo", limiteLogo, controlador.logo);
