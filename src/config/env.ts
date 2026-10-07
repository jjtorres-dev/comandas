import "dotenv/config";
import { z } from "zod";

const esquema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, "JWT_SECRET debe tener al menos 32 caracteres"),
  PORT: z.coerce.number().int().positive().default(3000),
  // Origen del frontend para CORS
  FRONTEND_URL: z.url().default("http://localhost:5173"),
});

const resultado = esquema.safeParse(process.env);
if (!resultado.success) {
  const detalle = resultado.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Variables de entorno inválidas (revisa .env):\n${detalle}`);
}

export const env = resultado.data;
