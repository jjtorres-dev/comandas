import type { Server as ServidorHttp } from "node:http";
import { Server } from "socket.io";
import { opcionesCors } from "../config/cors";
import { validarSesion, type Sesion } from "../middlewares/auth";

let io: Server | null = null;

const sala = (negocioId: string) => `negocio:${negocioId}`;

// Monta Socket.IO sobre el servidor HTTP. El JWT va en el handshake:
// io(url, { auth: { token } })
export function iniciarSocket(servidor: ServidorHttp): Server {
  io = new Server(servidor, { cors: opcionesCors });

  io.use(async (socket, next) => {
    try {
      socket.data.sesion = await validarSesion(socket.handshake.auth?.token);
      next();
    } catch {
      next(new Error("No autenticado"));
    }
  });

  io.on("connection", (socket) => {
    const sesion = socket.data.sesion as Sesion;
    socket.join(sala(sesion.negocioId));
  });

  return io;
}

// Emite solo a los sockets del negocio. Llamar después de confirmar la transacción.
export function emitirANegocio(negocioId: string, evento: string, datos: unknown) {
  io?.to(sala(negocioId)).emit(evento, datos);
}
