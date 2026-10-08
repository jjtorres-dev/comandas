// El personal del negocio. El dueño crea a su gente, cambia contraseñas y
// desactiva; nunca puede dejarse a sí mismo (ni al negocio) sin un ADMIN.
import bcrypt from "bcrypt";
import { Rol } from "../../generated/prisma/client.js";
import { conflicto, noEncontrado } from "../../lib/errores.js";
import { prisma } from "../../lib/prisma.js";
import type { Sesion } from "../../middlewares/auth.js";
import type { DatosCrearUsuario, DatosEditarUsuario } from "./admin.schemas.js";

const visible = { id: true, nombre: true, usuario: true, roles: true, activo: true, creadoEn: true } as const;

export const listarUsuarios = (negocioId: string) =>
  prisma.usuario.findMany({ where: { negocioId }, orderBy: [{ activo: "desc" }, { nombre: "asc" }], select: visible });

const usuarioDe = async (negocioId: string, id: string) => {
  const usuario = await prisma.usuario.findFirst({ where: { id, negocioId } });
  if (!usuario) throw noEncontrado("Esa persona no existe");
  return usuario;
};

async function exigirUsuarioLibre(negocioId: string, usuario: string, exceptoId?: string) {
  const ocupado = await prisma.usuario.findFirst({ where: { negocioId, usuario, ...(exceptoId ? { NOT: { id: exceptoId } } : {}) } });
  if (ocupado) throw conflicto("USUARIO_EN_USO", `Ya hay alguien con el usuario "${usuario}". Elige otro`);
}

export async function crearUsuario(negocioId: string, datos: DatosCrearUsuario) {
  await exigirUsuarioLibre(negocioId, datos.usuario);
  return prisma.usuario.create({
    data: { negocioId, nombre: datos.nombre, usuario: datos.usuario, roles: datos.roles, passwordHash: await bcrypt.hash(datos.password, 10) },
    select: visible,
  });
}

export async function editarUsuario(sesion: Sesion, id: string, datos: DatosEditarUsuario) {
  const { negocioId } = sesion;
  const actual = await usuarioDe(negocioId, id);
  const roles = datos.roles ?? actual.roles;
  const activo = datos.activo ?? actual.activo;
  const dejaDeSerAdmin = actual.roles.includes(Rol.ADMIN) && actual.activo && (!roles.includes(Rol.ADMIN) || !activo);

  // El dueño no se quita a sí mismo: se quedaría fuera del sistema
  if (id === sesion.usuarioId && dejaDeSerAdmin) {
    throw conflicto("ES_TU_USUARIO", "No puedes quitarte el puesto de dueño ni desactivarte: te quedarías fuera del sistema");
  }
  // Y el negocio nunca se queda sin nadie que pueda administrarlo
  if (dejaDeSerAdmin) {
    const otros = await prisma.usuario.count({ where: { negocioId, activo: true, roles: { has: Rol.ADMIN }, NOT: { id } } });
    if (otros === 0) throw conflicto("ULTIMO_ADMIN", "Tiene que quedar al menos un dueño activo");
  }
  if (datos.usuario && datos.usuario !== actual.usuario) await exigirUsuarioLibre(negocioId, datos.usuario, id);

  return prisma.usuario.update({ where: { id }, data: datos, select: visible });
}

export async function cambiarPassword(negocioId: string, id: string, password: string) {
  await usuarioDe(negocioId, id);
  await prisma.usuario.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
}
