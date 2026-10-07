import { z } from "zod";
import { esquemaMonto } from "../../lib/dinero";

const MONTO_MAXIMO = 999_999;

export const esquemaAbrirCaja = z.object({ montoInicial: esquemaMonto(MONTO_MAXIMO) });

export const esquemaCerrarCaja = z.object({
  efectivoContado: esquemaMonto(MONTO_MAXIMO),
  observacion: z.string().trim().max(500).optional(),
});

export type DatosAbrirCaja = z.infer<typeof esquemaAbrirCaja>;
export type DatosCerrarCaja = z.infer<typeof esquemaCerrarCaja>;
