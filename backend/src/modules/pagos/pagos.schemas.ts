import { z } from "zod";
import { MetodoPago, Prisma } from "../../generated/prisma/client.js";

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

export const esquemaRegistrarPagos = z
  .object({
    // Varios pagos en un mismo request = pago mixto
    pagos: z.array(esquemaPago).min(1).max(10),
    // UUID generado por la caja para este cobro: si la respuesta se pierde y
    // se reintenta, no se cobra dos veces
    idCobro: z.uuid().optional(),
    // Cuenta dividida por platos enteros: los items que se están pagando
    itemIds: z.array(z.uuid()).min(1).max(100).optional(),
    // Cuenta dividida por unidades: cuántas unidades de cada item se pagan
    items: z
      .array(z.object({ itemId: z.uuid(), cantidad: z.number().int().min(1).max(99) }))
      .min(1)
      .max(100)
      .optional(),
  })
  .superRefine((datos, ctx) => {
    if (datos.itemIds && datos.items) {
      ctx.addIssue({ code: "custom", path: ["items"], message: "Envía itemIds o items, no los dos" });
    }
    const ids = datos.items?.map((i) => i.itemId) ?? [];
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", path: ["items"], message: "Hay items repetidos" });
    }
  });

// Cambiar el método de un pago ya registrado (se cobró bien, se anotó mal)
export const esquemaCambiarMetodo = z.object({
  metodo: z.enum(MetodoPago),
  // Solo EFECTIVO: con cuánto pagó el cliente. Si falta, se asume pago exacto
  recibido: esquemaMontoPositivo.optional(),
  referencia: z.string().trim().max(100).optional(),
});

export const esquemaAnularPago = z.object({
  motivo: z.string().trim().min(3, "Escribe el motivo de la anulación").max(200),
});

export const esquemaParamsPago = z.object({ id: z.uuid(), pagoId: z.uuid() });

export type DatosRegistrarPagos = z.infer<typeof esquemaRegistrarPagos>;
export type DatosCambiarMetodo = z.infer<typeof esquemaCambiarMetodo>;
export type DatosAnularPago = z.infer<typeof esquemaAnularPago>;
