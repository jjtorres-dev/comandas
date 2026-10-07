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

const esquema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  PORT: z.coerce.number().int().positive().default(3000),
  // Origen del frontend para CORS
  FRONTEND_URL: z.url().default("http://localhost:5173"),
  // Proxies de confianza: de ahí sale la IP real para el límite de intentos de login
  TRUST_PROXY: z.string().optional().transform(leerTrustProxy),
});

const resultado = esquema.safeParse(process.env);
if (!resultado.success) {
  const detalle = resultado.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Variables de entorno inválidas (revisa .env):\n${detalle}`);
}

export const env = resultado.data;
