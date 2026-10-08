import { createContext, useContext } from "react";
import type { Negocio, Rol, Usuario } from "../lib/tipos";

export type DatosDeLogin = { codigoNegocio: string; usuario: string; password: string };

export type ContextoSesion = {
  // "cargando": hay token y todavía se está comprobando con el servidor.
  // "sin-servidor": hay token pero el servidor no respondió (se puede reintentar)
  estado: "cargando" | "sin-servidor" | "sin-sesion" | "con-sesion";
  token: string | null;
  usuario: Usuario | null;
  negocio: Negocio | null;
  // Código recordado en este dispositivo: el login lo pide solo la primera vez
  codigoNegocio: string | null;
  recordarNegocio: (codigo: string | null) => void;
  iniciarSesion: (datos: DatosDeLogin) => Promise<void>;
  cerrarSesion: () => void;
  // Vuelve a comprobar la sesión tras un "sin-servidor"
  reintentar: () => void;
};

export const Contexto = createContext<ContextoSesion | null>(null);

export function useSesion(): ContextoSesion {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useSesion debe usarse dentro de <ProveedorSesion>");
  return contexto;
}

// A dónde entra cada quien: quien trabaja en cocina y caja, a /local (aunque
// también sea dueño: lo suyo en hora punta es la cocina); el dueño que no
// cocina, a /admin; el mozo, a /mozo
export function inicioDe(roles: Rol[]): "/mozo" | "/local" | "/admin" {
  if (roles.includes("LOCAL")) return "/local";
  return roles.includes("ADMIN") ? "/admin" : "/mozo";
}

const NOMBRES_DE_ROL: Record<Rol, string> = { ADMIN: "Dueño", MOZO: "Mozo", LOCAL: "Cocina y caja" };

export const nombreDeRoles = (roles: Rol[]): string => roles.map((r) => NOMBRES_DE_ROL[r]).join(" · ");
