import { z } from "zod";
import { Prisma } from "../generated/prisma/client.js";

export const CERO = new Prisma.Decimal(0);

// Los montos viajan en el JSON como texto con 2 decimales ("25.00"),
// para no perder precisión con números de punto flotante
export const dinero = (monto: Prisma.Decimal): string => monto.toFixed(2);

export const sumar = (montos: Prisma.Decimal[]): Prisma.Decimal =>
  montos.reduce((suma, m) => suma.plus(m), CERO);

// Monto de entrada: número con 2 decimales como máximo
export const esquemaMonto = (max: number) =>
  z
    .number()
    .min(0)
    .max(max)
    .multipleOf(0.01)
    .transform((n) => new Prisma.Decimal(n));
