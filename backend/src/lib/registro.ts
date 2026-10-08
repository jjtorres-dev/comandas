import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pino } from "pino";
import { pinoHttp } from "pino-http";
import { env } from "../config/env.js";

const NIVEL_POR_ENTORNO = { production: "info", development: "warn", test: "silent" } as const;

// Registros en JSON, una línea por evento (Railway los muestra y filtra tal cual).
// Nunca llevan contraseñas ni tokens: los cuerpos no se registran y las
// cabeceras sensibles se tachan.
export const registro = pino({
  level: env.LOG_LEVEL ?? NIVEL_POR_ENTORNO[env.NODE_ENV],
  base: undefined, // sin pid ni hostname: en un contenedor no dicen nada
  timestamp: pino.stdTimeFunctions.isoTime,
  // "info", "error"… en palabras, que es como se filtran en Railway
  formatters: { level: (nivel) => ({ level: nivel }) },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "*.password",
      "*.passwordHash",
      "*.token",
      "*.JWT_SECRET",
      "*.DATABASE_URL",
    ],
    censor: "[oculto]",
  },
});

// Un id por petición: sale en cada línea del registro y en la cabecera
// X-Request-Id, para encontrar en los logs lo que le pasó a alguien
const ID_VALIDO = /^[\w-]{8,64}$/;

export const registrarPeticiones = pinoHttp({
  logger: registro,
  genReqId(req: IncomingMessage, res: ServerResponse) {
    const recibido = req.headers["x-request-id"];
    const id = typeof recibido === "string" && ID_VALIDO.test(recibido) ? recibido : randomUUID();
    res.setHeader("X-Request-Id", id);
    return id;
  },
  // El chequeo de salud llega cada pocos segundos: solo ruido
  autoLogging: { ignore: (req: IncomingMessage) => req.url === "/api/salud" },
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, error?: Error) => (error || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info"),
  serializers: {
    // Solo método y ruta. Sin la consulta (?telefono=…) ni cabeceras: ahí van datos de clientes y el token
    req: (req: { id: string; method: string; url: string }) => ({ id: req.id, method: req.method, url: req.url.split("?")[0] }),
    res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
  },
});
