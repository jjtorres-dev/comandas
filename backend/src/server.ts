import { createServer } from "node:http";
import { app } from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";
import { registro } from "./lib/registro.js";
import { iniciarSocket } from "./realtime/socket.js";

const servidor = createServer(app);
const io = iniciarSocket(servidor);

servidor.listen(env.PORT, () => {
  // Se ve también en desarrollo, donde el registro solo muestra avisos y errores
  console.log(`Comandas escuchando en el puerto ${env.PORT} (${env.NODE_ENV})`);
});

// Railway avisa con SIGTERM antes de reemplazar el contenedor: se deja de
// aceptar conexiones y se cierra la base antes de salir
async function apagar(senal: string) {
  registro.info({ senal }, "Apagando el servidor");
  await io.close(); // también cierra el servidor HTTP
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void apagar("SIGINT"));
process.on("SIGTERM", () => void apagar("SIGTERM"));
// Un error que nadie atrapó deja el proceso en un estado dudoso: se registra y
// se sale, y Railway lo vuelve a levantar
process.on("uncaughtException", (error) => {
  registro.fatal({ err: error }, "Error no atrapado");
  process.exit(1);
});
process.on("unhandledRejection", (motivo) => {
  registro.fatal({ err: motivo }, "Promesa rechazada sin atrapar");
  process.exit(1);
});
