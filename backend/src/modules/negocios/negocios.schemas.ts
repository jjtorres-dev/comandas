import { z } from "zod";

export const esquemaCodigoNegocio = z.object({
  codigo: z.string().trim().toLowerCase().min(1).max(50),
});
