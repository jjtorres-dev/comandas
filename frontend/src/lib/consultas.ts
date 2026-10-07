import { QueryClient } from "@tanstack/react-query";
import { ErrorApi } from "./api";

// Claves de TanStack Query. Los eventos de Socket.IO invalidan por estas raíces.
export const claves = {
  sesion: (token: string | null) => ["sesion", token] as const,
  negocioPublico: (codigo: string) => ["negocio-publico", codigo] as const,
  pedidos: ["pedidos"] as const,
  mesas: ["mesas"] as const,
  caja: ["caja"] as const,
};

export const clienteDeConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Reintentar solo fallos de red o del servidor: un 4xx no cambia al repetirlo
      retry: (intentos, error) =>
        intentos < 2 && !(error instanceof ErrorApi && error.status >= 400 && error.status < 500),
    },
  },
});
