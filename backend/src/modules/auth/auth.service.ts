import bcrypt from "bcrypt";
import { noAutenticado } from "../../lib/errores";
import { prisma } from "../../lib/prisma";
import { firmarToken, type Sesion } from "../../middlewares/auth";
import type { DatosLogin } from "./auth.schemas";

// Hash de relleno: si el usuario no existe igual se compara contra algo,
// para que el tiempo de respuesta no revele qué usuarios existen
const HASH_RELLENO = bcrypt.hashSync("relleno", 10);

// Lo que el frontend necesita del negocio: identificarlo y pintar su marca
const negocioDeSesion = { id: true, codigo: true, nombre: true, logoUrl: true } as const;
const usuarioDeSesion = { id: true, nombre: true, usuario: true, roles: true } as const;

export async function login({ codigoNegocio, usuario, password }: DatosLogin) {
  const encontrado = await prisma.usuario.findFirst({
    where: { usuario, activo: true, negocio: { codigo: codigoNegocio, activo: true } },
    include: { negocio: { select: negocioDeSesion } },
  });

  const coincide = await bcrypt.compare(password, encontrado?.passwordHash ?? HASH_RELLENO);
  // Mismo mensaje para negocio, usuario o contraseña incorrectos: no da pistas
  if (!encontrado || !coincide) throw noAutenticado("Negocio, usuario o contraseña incorrectos");

  const token = firmarToken({
    usuarioId: encontrado.id,
    negocioId: encontrado.negocioId,
    roles: encontrado.roles,
  });

  return {
    token,
    usuario: {
      id: encontrado.id,
      nombre: encontrado.nombre,
      usuario: encontrado.usuario,
      roles: encontrado.roles,
    },
    negocio: encontrado.negocio,
  };
}

// Usuario y negocio de la sesión actual, leídos de la base (no del token)
export async function yo({ usuarioId, negocioId }: Sesion) {
  const encontrado = await prisma.usuario.findFirst({
    where: { id: usuarioId, negocioId },
    select: { ...usuarioDeSesion, negocio: { select: negocioDeSesion } },
  });
  if (!encontrado) throw noAutenticado("Tu sesión ya no es válida. Vuelve a iniciar sesión");

  const { negocio, ...usuario } = encontrado;
  return { usuario, negocio };
}
