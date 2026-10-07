import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { api, configurarApi } from "../lib/api";
import { claves } from "../lib/consultas";
import type { RespuestaLogin, Sesion } from "../lib/tipos";
import { almacen } from "./almacen";
import { Contexto, type ContextoSesion, type DatosDeLogin } from "./contexto";

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const consultas = useQueryClient();
  const { token, codigoNegocio } = useSyncExternalStore(almacen.suscribir, almacen.leer);

  const cerrarSesion = useCallback(() => {
    almacen.fijarToken(null);
    // Nada de un usuario debe quedar en memoria para el siguiente
    consultas.clear();
  }, [consultas]);

  // El cliente de la API toma el token de aquí y avisa si un 401 lo invalida
  useEffect(() => {
    configurarApi({
      obtenerToken: () => almacen.leer().token,
      alPerderSesion: (mensaje) => {
        if (!almacen.leer().token) return; // varias peticiones pueden fallar a la vez
        cerrarSesion();
        toast.error(mensaje, { id: "sesion-perdida" });
      },
    });
  }, [cerrarSesion]);

  // Con token guardado, el usuario y el negocio se piden al servidor al abrir la app
  const { data, isError, refetch } = useQuery({
    queryKey: claves.sesion(token),
    queryFn: ({ signal }) => api<Sesion>("/auth/yo", { signal }),
    enabled: token !== null,
    staleTime: 5 * 60_000,
  });

  const iniciarSesion = useCallback(
    async (datos: DatosDeLogin) => {
      const { token: nuevo, ...resto } = await api<RespuestaLogin>("/auth/login", { metodo: "POST", cuerpo: datos });
      consultas.setQueryData(claves.sesion(nuevo), resto);
      almacen.fijarNegocio(resto.negocio.codigo);
      almacen.fijarToken(nuevo);
    },
    [consultas],
  );

  const valor = useMemo<ContextoSesion>(() => {
    const datos = token ? data : undefined;
    return {
      estado: !token ? "sin-sesion" : datos ? "con-sesion" : isError ? "sin-servidor" : "cargando",
      token,
      usuario: datos?.usuario ?? null,
      negocio: datos?.negocio ?? null,
      codigoNegocio,
      recordarNegocio: almacen.fijarNegocio,
      iniciarSesion,
      cerrarSesion,
      reintentar: () => void refetch(),
    };
  }, [token, codigoNegocio, data, isError, refetch, iniciarSesion, cerrarSesion]);

  return <Contexto value={valor}>{children}</Contexto>;
}
