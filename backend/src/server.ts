import { createServer } from "node:http";
import { app } from "./app";
import { env } from "./config/env";
import { prisma } from "./lib/prisma";
import { iniciarSocket } from "./realtime/socket";

const servidor = createServer(app);
const io = iniciarSocket(servidor);

servidor.listen(env.PORT, () => {
  console.log(`Comandas escuchando en http://localhost:${env.PORT}`);
});

async function apagar() {
  await io.close(); // también cierra el servidor HTTP
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", apagar);
process.on("SIGTERM", apagar);
