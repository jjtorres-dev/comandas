import { noEncontrado } from "../../lib/errores";
import { prisma } from "../../lib/prisma";

// Lo único que se puede ver de un negocio sin iniciar sesión: el login lo
// muestra antes de pedir usuario y contraseña
export async function datosPublicos(codigo: string) {
  const negocio = await prisma.negocio.findFirst({
    where: { codigo, activo: true },
    select: { nombre: true, logoUrl: true },
  });
  if (!negocio) throw noEncontrado("No existe un negocio con ese código");
  return negocio;
}
