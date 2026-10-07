import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "../config/env";
import { Prisma, PrismaClient } from "../generated/prisma/client";

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

// Cliente dentro de una transacción interactiva
export type Tx = Prisma.TransactionClient;
