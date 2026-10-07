import { z } from "zod";
import { MetodoPago, Prisma } from "../../generated/prisma/client";

// Monto mayor que cero, con 2 decimales como máximo
const esquemaMontoPositivo = z
  .number()
  .positive()
  .max(99_999)
  .multipleOf(0.01)
  .transform((n) => new Prisma.Decimal(n));

const esquemaPago = z
  .object({
    metodo: z.enum(MetodoPago),
    monto: esquemaMontoPositivo,
    // Solo EFECTIVO: con cuánto pagó el cliente. Si falta, se asume pago exacto
    recibido: esquemaMontoPositivo.optional(),
    // Nº de operación Yape/Plin o voucher
    referencia: z.string().trim().max(100).optional(),
  })
  .superRefine((pago, ctx) => {
    if (pago.recibido === undefined) return;
    if (pago.metodo !== MetodoPago.EFECTIVO) {
      ctx.addIssue({ code: "custom", path: ["recibido"], message: "Solo los pagos en efectivo llevan recibido" });
    } else if (pago.recibido.lessThan(pago.monto)) {
      ctx.addIssue({ code: "custom", path: ["recibido"], message: "Lo recibido no puede ser menor que el monto" });
    }
  });

export const esquemaRegistrarPagos = z.object({
  // Varios pagos en un mismo request = pago mixto
  pagos: z.array(esquemaPago).min(1).max(10),
  // Cuenta dividida: los items que se están pagando
  itemIds: z.array(z.uuid()).min(1).max(100).optional(),
});

export type DatosRegistrarPagos = z.infer<typeof esquemaRegistrarPagos>;
