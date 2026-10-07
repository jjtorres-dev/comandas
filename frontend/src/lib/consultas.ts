import { QueryClient, queryOptions } from "@tanstack/react-query";
import { api, ErrorApi } from "./api";
import type { Carta, Mesa, Pedido } from "./tipos";

// Claves de TanStack Query. Los eventos de Socket.IO invalidan por estas raíces.
export const claves = {
  sesion: (token: string | null) => ["sesion", token] as const,
  negocioPublico: (codigo: string) => ["negocio-publico", codigo] as const,
  pedidos: ["pedidos"] as const,
  mesas: ["mesas"] as const,
  caja: ["caja"] as const,
  carta: ["carta"] as const,
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

// La carta cambia poco: se pide una vez y se reutiliza durante el turno
export const consultaCarta = queryOptions({
  queryKey: claves.carta,
  queryFn: ({ signal }) => api<Carta>("/carta", { signal }),
  staleTime: 5 * 60_000,
});

export const consultaMesas = queryOptions({
  queryKey: claves.mesas,
  queryFn: async ({ signal }) => (await api<{ mesas: Mesa[] }>("/mesas", { signal })).mesas,
});

export const consultaPedidosActivos = queryOptions({
  queryKey: [...claves.pedidos, "activos"] as const,
  queryFn: async ({ signal }) => (await api<{ pedidos: Pedido[] }>("/pedidos/activos", { signal })).pedidos,
});
