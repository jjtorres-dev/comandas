import "dotenv/config";
import { z } from "zod";

// Valor de "trust proxy" de Express a partir de TRUST_PROXY:
// vacío = no confiar en ningún proxy; "1" = un proxy delante (Railway);
// también acepta "true"/"false" o una lista de IPs/subredes
export function leerTrustProxy(valor: string | undefined): boolean | number | string | undefined {
  const texto = valor?.trim();
  if (!texto) return undefined;
  if (texto === "true") return true;
  if (texto === "false") return false;
  return /^\d+$/.test(texto) ? Number(texto) : texto;
}

// Secretos de ejemplo que nunca deben llegar a producción
const SECRETOS_DE_EJEMPLO = ["cambia-este-secreto-por-uno-largo-y-aleatorio"];

const esquema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z
    .string({ error: "falta. Es la conexión a PostgreSQL (postgresql://usuario:clave@host:puerto/base)" })
    .regex(/^postgres(ql)?:\/\/.+/, "tiene que empezar con postgresql://"),
  JWT_SECRET: z
    .string({ error: "falta. Genera uno con: openssl rand -hex 32" })
    .min(32, "debe tener al menos 32 caracteres. Genera uno con: openssl rand -hex 32"),
  PORT: z.coerce.number({ error: "tiene que ser un número de puerto" }).int().min(1).max(65535).default(3000),
  // Solo desarrollo: origen del frontend para CORS. En producción el backend
  // sirve el frontend desde el mismo origen y no hay CORS
  FRONTEND_URL: z.url().default("http://localhost:5173"),
  // Proxies de confianza: de ahí sale la IP real para los límites por IP
  TRUST_PROXY: z.string().optional().transform(leerTrustProxy),
  // Solo producción: carpeta con el build del frontend. Por defecto, ../frontend/dist
  FRONTEND_DIST: z.string().min(1).optional(),
  // Nivel de los registros (pino). Por defecto: info en producción, warn en desarrollo
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
});

// Revisa las variables y devuelve los problemas en palabras. En producción
// nada se da por supuesto: todas tienen que venir escritas.
export function leerEntorno(variables: NodeJS.ProcessEnv) {
  const resultado = esquema.safeParse(variables);
  const problemas = resultado.success ? [] : resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);

  if (variables.NODE_ENV === "production") {
    if (!variables.PORT?.trim()) problemas.push("PORT: falta. Railway la define sola; fuera de Railway, por ejemplo 3000");
    if (variables.TRUST_PROXY === undefined || !variables.TRUST_PROXY.trim()) {
      problemas.push('TRUST_PROXY: falta. En Railway va "1" (hay un proxy delante); sin proxy, "false"');
    }
    if (SECRETOS_DE_EJEMPLO.includes(variables.JWT_SECRET ?? "")) {
      problemas.push("JWT_SECRET: es el secreto de ejemplo. Genera uno propio con: openssl rand -hex 32");
    }
  }

  return resultado.success && problemas.length === 0 ? { ok: true as const, env: resultado.data } : { ok: false as const, problemas };
}

const leido = leerEntorno(process.env);
if (!leido.ok) {
  const mensaje = `No se puede arrancar: faltan o están mal estas variables de entorno\n${leido.problemas.map((p) => `  - ${p}`).join("\n")}`;
  // En las pruebas se lanza; al arrancar de verdad se explica y se sale, sin traza
  if (process.env.NODE_ENV === "test") throw new Error(mensaje);
  console.error(mensaje);
  process.exit(1);
}

export const env = leido.env;
