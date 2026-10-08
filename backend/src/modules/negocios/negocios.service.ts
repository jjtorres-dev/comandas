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

// La imagen del logo, tal como se subió. 404 si el negocio no tiene.
export async function logoDe(codigo: string) {
  const negocio = await prisma.negocio.findFirst({
    where: { codigo, activo: true },
    select: { logo: true, logoTipo: true },
  });
  if (!negocio?.logo || !negocio.logoTipo) throw noEncontrado("Este negocio no tiene logo");
  return { imagen: negocio.logo, tipo: negocio.logoTipo };
}
