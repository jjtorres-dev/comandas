import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env.js";
import { Rol } from "../generated/prisma/client.js";
import { noAutenticado, sinPermiso } from "../lib/errores.js";
import { prisma } from "../lib/prisma.js";

// Contenido del JWT. REGLA DE ORO: el negocioId siempre sale de aquí,
// nunca del body ni de la URL.
const esquemaToken = z.object({
  usuarioId: z.string(),
  negocioId: z.string(),
  roles: z.array(z.enum(Rol)),
});

export type Sesion = z.infer<typeof esquemaToken>;

declare global {
  namespace Express {
    interface Request {
      sesion?: Sesion;
    }
  }
}

const DURACION_TOKEN = "12h"; // cubre un turno completo

export function firmarToken(sesion: Sesion): string {
  return jwt.sign(sesion, env.JWT_SECRET, { algorithm: "HS256", expiresIn: DURACION_TOKEN });
}

// Lanza 401 si el token falta, está mal firmado o venció, o si el usuario
// ya no está activo o sus roles cambiaron desde que inició sesión
export async function validarSesion(token: string | undefined): Promise<Sesion> {
  if (!token) throw noAutenticado();

  let sesion: Sesion;
  try {
    sesion = esquemaToken.parse(jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }));
  } catch {
    throw noAutenticado("Sesión inválida o vencida. Vuelve a iniciar sesión");
  }

  const usuario = await prisma.usuario.findFirst({
    where: { id: sesion.usuarioId, negocioId: sesion.negocioId, activo: true, negocio: { activo: true } },
    select: { roles: true },
  });
  const mismosRoles =
    usuario?.roles.length === sesion.roles.length && usuario.roles.every((r) => sesion.roles.includes(r));
  if (!usuario || !mismosRoles) {
    throw noAutenticado("Tu sesión ya no es válida. Vuelve a iniciar sesión");
  }

  return sesion;
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (req.sesion) return next(); // ya validada por un router anterior
  const [esquema, token] = (req.headers.authorization ?? "").split(" ");
  if (esquema !== "Bearer") throw noAutenticado();
  req.sesion = await validarSesion(token);
  next();
}

// Deja pasar si el usuario tiene al menos uno de los roles indicados
export function requireRol(...roles: Rol[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!sesionDe(req).roles.some((r) => roles.includes(r))) throw sinPermiso();
    next();
  };
}

// Sesión de una ruta protegida por requireAuth
export function sesionDe(req: Request): Sesion {
  if (!req.sesion) throw noAutenticado();
  return req.sesion;
}
