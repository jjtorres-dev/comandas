import { Navigate, Outlet } from "react-router";
import { PantallaCarga } from "../componentes/PantallaCarga";
import type { Rol } from "../lib/tipos";
import { inicioDe, useSesion } from "../sesion/contexto";
import { ContextoConexion } from "../tiempo-real/contexto";
import { useTiempoReal } from "../tiempo-real/useTiempoReal";

// Todo lo que requiere sesión cuelga de aquí: una sola conexión de tiempo
// real compartida por las rutas de mozo y de local.
export function Autenticado() {
  const { estado, token, cerrarSesion } = useSesion();
  const conexion = useTiempoReal(estado === "con-sesion" ? token : null, cerrarSesion);

  if (estado === "cargando" || estado === "sin-servidor") return <PantallaCarga />;
  if (estado === "sin-sesion") return <Navigate to="/login" replace />;

  return (
    <ContextoConexion value={conexion}>
      <Outlet />
    </ContextoConexion>
  );
}

// Deja pasar solo a los roles indicados; al resto lo manda a su propio inicio
export function SoloRoles({ roles }: { roles: Rol[] }) {
  const { usuario } = useSesion();
  if (!usuario) return <Navigate to="/login" replace />;
  if (!usuario.roles.some((r) => roles.includes(r))) return <Navigate to={inicioDe(usuario.roles)} replace />;
  return <Outlet />;
}

// "/" y cualquier ruta desconocida llevan al inicio del rol
export function IrAlInicio() {
  const { estado, usuario } = useSesion();
  if (estado === "cargando" || estado === "sin-servidor") return <PantallaCarga />;
  return <Navigate to={usuario ? inicioDe(usuario.roles) : "/login"} replace />;
}
