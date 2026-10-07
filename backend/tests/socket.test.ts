import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { io as conectar, type Socket } from "socket.io-client";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { iniciarSocket } from "../src/realtime/socket";
import { app, conToken, crearNegocio, limpiarBase, prisma, tokenDe, type NegocioDePrueba } from "./helpers";

let servidor: Server;
let url: string;
let a: NegocioDePrueba;
let b: NegocioDePrueba;
const sockets: Socket[] = [];

beforeAll(async () => {
  await limpiarBase();
  a = await crearNegocio("Negocio A", "negocio-a");
  b = await crearNegocio("Negocio B", "negocio-b");

  servidor = createServer(app);
  iniciarSocket(servidor);
  await new Promise<void>((listo) => servidor.listen(0, listo));
  url = `http://localhost:${(servidor.address() as AddressInfo).port}`;
});

afterAll(async () => {
  sockets.forEach((s) => s.close());
  await new Promise((listo) => servidor.close(listo));
  await prisma.$disconnect();
});

// Conecta y devuelve el socket junto con todos los eventos que vaya recibiendo
async function escuchar(token?: string) {
  const socket = conectar(url, { auth: { token }, transports: ["websocket"], reconnection: false });
  sockets.push(socket);
  const eventos: { evento: string; pedido: Record<string, unknown> }[] = [];
  socket.onAny((evento, pedido) => eventos.push({ evento, pedido }));
  await new Promise<void>((ok, error) => {
    socket.on("connect", ok);
    socket.on("connect_error", error);
  });
  return { socket, eventos };
}

describe("Socket.IO", () => {
  it("rechaza el handshake sin un JWT válido", async () => {
    await expect(escuchar()).rejects.toThrow("No autenticado");
    await expect(escuchar("token-falso")).rejects.toThrow("No autenticado");
  });

  it("emite pedido:creado y pedido:actualizado solo a la sala del negocio", async () => {
    const mozo = await tokenDe(a, "mozo");
    const cocina = await tokenDe(a, "cocina");
    const deA = await escuchar(cocina);
    const deB = await escuchar(await tokenDe(b, "cocina"));

    const creado = await request(servidor)
      .post("/api/pedidos")
      .set(conToken(mozo))
      .send({
        tipo: "PARA_LLEVAR",
        idCliente: "0b7f6a52-3a0e-4a65-8f43-3f3c1b6a9d10",
        items: [{ varianteId: a.v.ceviche, cantidad: 1, notas: [] }],
      });
    const { pedido } = creado.body;
    await request(servidor)
      .patch(`/api/pedidos/${pedido.id}/items/estado`)
      .set(conToken(mozo))
      .send({ areaId: a.areas.cocina.id, estado: "LISTO" });

    await expect.poll(() => deA.eventos.length).toBe(2);

    expect(deA.eventos[0]).toEqual({ evento: "pedido:creado", pedido });
    expect(deA.eventos[1].evento).toBe("pedido:actualizado");
    expect(deA.eventos[1].pedido).toMatchObject({ id: pedido.id, estado: "LISTO" });

    // Caja: abrir y cobrar avisan con el resumen del turno
    await request(servidor).post("/api/caja/abrir").set(conToken(cocina)).send({ montoInicial: 50 });
    await request(servidor)
      .post(`/api/pedidos/${pedido.id}/pagos`)
      .set(conToken(cocina))
      .send({ pagos: [{ metodo: "EFECTIVO", monto: 21 }] }); // S/ 20 + 1 taper

    await expect.poll(() => deA.eventos.length).toBe(5);
    expect(deA.eventos.slice(2).map((e) => e.evento)).toEqual(["caja:actualizada", "pedido:actualizado", "caja:actualizada"]);
    expect(deA.eventos[3].pedido).toMatchObject({ id: pedido.id, pagado: true, saldoPendiente: "0.00" });
    expect(deA.eventos[4].pedido).toMatchObject({ efectivoEsperado: "71.00", pedidosCobrados: 1 });
    expect(deB.eventos).toEqual([]);
  });

  it("rechaza el handshake de un usuario desactivado", async () => {
    const token = await tokenDe(b, "mozo");
    await prisma.usuario.updateMany({ where: { negocioId: b.negocio.id, usuario: "mozo" }, data: { activo: false } });

    await expect(escuchar(token)).rejects.toThrow("No autenticado");
  });
});
