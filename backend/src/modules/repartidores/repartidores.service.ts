import { prisma } from "../../lib/prisma.js";

export async function listarActivos(negocioId: string) {
  return prisma.repartidor.findMany({
    where: { negocioId, activo: true },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, telefono: true },
  });
}
