import { prisma } from "../../lib/prisma";

// Para autocompletar el formulario de delivery. null si el teléfono es nuevo.
export async function buscarPorTelefono(negocioId: string, telefono: string) {
  const cliente = await prisma.cliente.findUnique({
    where: { negocioId_telefono: { negocioId, telefono } },
    select: { id: true, telefono: true, nombre: true, direccion: true, distrito: true, referencia: true },
  });
  return cliente;
}
