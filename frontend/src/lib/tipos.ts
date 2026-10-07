// Tipos de la API (referencia: backend/docs/API.md)

export type Rol = "ADMIN" | "MOZO" | "LOCAL";

export type Usuario = {
  id: string;
  nombre: string;
  usuario: string;
  roles: Rol[];
};

export type Negocio = {
  id: string;
  codigo: string;
  nombre: string;
  logoUrl: string | null;
};

export type NegocioPublico = Pick<Negocio, "nombre" | "logoUrl">;

export type Sesion = { usuario: Usuario; negocio: Negocio };

export type RespuestaLogin = Sesion & { token: string };
