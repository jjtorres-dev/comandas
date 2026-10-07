import { EstadoPedido } from "../../generated/prisma/client";
import { dinero } from "../../lib/dinero";
import { prisma } from "../../lib/prisma";

// Una mesa está ocupada si tiene un pedido no pagado y no cancelado. No cuenta
// el que volvió a quedar por cobrar (pago anulado) con la mesa ya ocupada por otro.
export async function listarMesas(negocioId: string) {
  const mesas = await prisma.mesa.findMany({
    where: { negocioId, activo: true },
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    include: {
      pedidos: {
        where: { negocioId, pagado: false, mesaLiberada: false, estado: { not: EstadoPedido.CANCELADO } },
        orderBy: { creadoEn: "asc" },
        take: 1,
      },
    },
  });

  return mesas.map((m) => {
    const [abierto] = m.pedidos;
    return {
      id: m.id,
      nombre: m.nombre,
      estado: abierto ? ("ocupada" as const) : ("libre" as const),
      pedido: abierto
        ? {
            id: abierto.id,
            numero: abierto.numero,
            estado: abierto.estado,
            total: dinero(abierto.total),
            creadoEn: abierto.creadoEn,
          }
        : null,
    };
  });
}
