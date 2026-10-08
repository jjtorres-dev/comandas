import type { CorsOptions } from "cors";
import { env } from "./env.js";

// http(s)://192.168.x.x[:puerto]: el celular en la misma red wifi
const RED_LOCAL = /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/;

export function esOrigenPermitido(
  origen: string | undefined,
  opciones: { frontendUrl: string; desarrollo: boolean },
): boolean {
  if (!origen) return true; // curl, apps nativas y peticiones del mismo origen no envían Origin
  if (origen === new URL(opciones.frontendUrl).origin) return true;
  return opciones.desarrollo && RED_LOCAL.test(origen);
}

// Mismas reglas para Express y para Socket.IO
export const opcionesCors: CorsOptions = {
  origin(origen, listo) {
    listo(
      null,
      esOrigenPermitido(origen, {
        frontendUrl: env.FRONTEND_URL,
        desarrollo: env.NODE_ENV === "development",
      }),
    );
  },
};
