import { createContext, useContext } from "react";

export type EstadoConexion = "en-linea" | "reconectando";

export const ContextoConexion = createContext<EstadoConexion>("reconectando");

export const useConexion = (): EstadoConexion => useContext(ContextoConexion);
