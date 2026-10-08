// Datos del negocio: nombre, logo, reparto y umbrales de cocina
import { dinero } from "../../lib/dinero.js";
import { solicitudInvalida } from "../../lib/errores.js";
import { prisma } from "../../lib/prisma.js";
import type { DatosNegocio } from "./admin.schemas.js";
import { avisarCambio } from "./comun.js";

const campos = {
  id: true,
  codigo: true,
  nombre: true,
  logoUrl: true,
  costoEnvioDefault: true,
  precioTaper: true,
  distritos: true,
  region: true,
  umbralTardaMin: true,
  umbralMuyTardeMin: true,
} as const;

export async function obtenerNegocio(negocioId: string) {
  const n = await prisma.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: campos });
  return { ...n, costoEnvioDefault: dinero(n.costoEnvioDefault), precioTaper: dinero(n.precioTaper) };
}

export async function editarNegocio(negocioId: string, datos: DatosNegocio) {
  const actual = await prisma.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { umbralTardaMin: true, umbralMuyTardeMin: true } });
  const tarda = datos.umbralTardaMin ?? actual.umbralTardaMin;
  const muyTarde = datos.umbralMuyTardeMin ?? actual.umbralMuyTardeMin;
  if (tarda >= muyTarde) throw solicitudInvalida("El aviso rojo tiene que llegar después del ámbar");

  await prisma.negocio.update({ where: { id: negocioId }, data: { ...datos, region: datos.region === undefined ? undefined : datos.region || null } });
  avisarCambio(negocioId);
  return obtenerNegocio(negocioId);
}

// Firmas de los formatos que se aceptan: el tipo se decide por el contenido,
// no por lo que diga quien sube el archivo
function tipoDeImagen(imagen: Buffer): string | null {
  if (imagen.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (imagen.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (imagen.subarray(0, 4).toString("ascii") === "RIFF" && imagen.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export const LOGO_MAXIMO = 1024 * 1024;

export async function subirLogo(negocioId: string, imagen: Buffer) {
  const tipo = imagen.length > 0 ? tipoDeImagen(imagen) : null;
  if (!tipo) throw solicitudInvalida("El logo tiene que ser una imagen PNG, JPG o WebP");
  const { codigo } = await prisma.negocio.findUniqueOrThrow({ where: { id: negocioId }, select: { codigo: true } });
  // La dirección cambia con cada imagen: los navegadores no se quedan con la anterior
  await prisma.negocio.update({
    where: { id: negocioId },
    data: { logo: new Uint8Array(imagen), logoTipo: tipo, logoUrl: `/api/negocios/${codigo}/logo?v=${Date.now()}` },
  });
  avisarCambio(negocioId);
  return obtenerNegocio(negocioId);
}

export async function quitarLogo(negocioId: string) {
  await prisma.negocio.update({ where: { id: negocioId }, data: { logo: null, logoTipo: null, logoUrl: null } });
  avisarCambio(negocioId);
  return obtenerNegocio(negocioId);
}
