import { z } from "zod";

export const esquemaLogin = z.object({
  codigoNegocio: z.string().trim().toLowerCase().min(1).max(50),
  usuario: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200),
});

export type DatosLogin = z.infer<typeof esquemaLogin>;
