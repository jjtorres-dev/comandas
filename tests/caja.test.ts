import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  app,
  conToken,
  crearNegocio,
  crearPedido,
  limpiarBase,
  prisma,
  tokenDe,
  type NegocioDePrueba,
} from "./helpers";

let a: NegocioDePrueba;
let b: NegocioDePrueba;
let mozo: string;
let caja: string; // el usuario LOCAL: cocina y caja

beforeEach(async () => {
  await limpiarBase();
  a = await crearNegocio("Negocio A", "negocio-a");
  b = await crearNegocio("Negocio B", "negocio-b");
  [mozo, caja] = await Promise.all([tokenDe(a, "mozo"), tokenDe(a, "cocina")]);
});

afterAll(() => prisma.$disconnect());

const abrir = (token: string, montoInicial = 50) =>
  request(app).post("/api/caja/abrir").set(conToken(token)).send({ montoInicial });
const actual = (token: string) => request(app).get("/api/caja/actual").set(conToken(token));
const cerrar = (token: string, cuerpo: object) => request(app).post("/api/caja/cerrar").set(conToken(token)).send(cuerpo);
const pagar = (token: string, pedidoId: string, cuerpo: object) =>
  request(app).post(`/api/pedidos/${pedidoId}/pagos`).set(conToken(token)).send(cuerpo);
const cuenta = (token: string, pedidoId: string) => request(app).get(`/api/pedidos/${pedidoId}/cuenta`).set(conToken(token));
const mesas = async () => (await request(app).get("/api/mesas").set(conToken(mozo))).body.mesas;

// Pedido de la Mesa 1: 2 ceviches (40) + chicharrón de pota (10) + gaseosa (3) = S/ 53
async function pedidoDeMesa() {
  const res = await crearPedido(mozo, {
    mesaId: a.mesas[0].id,
    items: [{ varianteId: a.v.ceviche, cantidad: 2 }, { varianteId: a.v.pota10 }, { varianteId: a.v.gaseosa }],
  });
  const [ceviche, pota, gaseosa] = res.body.pedido.items.map((i: { id: string }) => i.id) as string[];
  return { id: res.body.pedido.id as string, ceviche, pota, gaseosa };
}

describe("apertura de caja", () => {
  it("abre un turno y solo permite uno abierto por negocio", async () => {
    expect((await actual(caja)).body).toEqual({ turno: null });

    const abierto = await abrir(caja, 50);
    const otraVez = await abrir(await tokenDe(a, "admin"), 10);
    const [s1, s2] = await Promise.all([abrir(await tokenDe(b, "cocina"), 0), abrir(await tokenDe(b, "admin"), 0)]);

    expect(abierto.status).toBe(201);
    expect(abierto.body.turno).toMatchObject({
      abierto: true,
      abiertoPor: { nombre: "cocina" },
      montoInicial: "50.00",
      totalesPorMetodo: { EFECTIVO: "0.00", YAPE: "0.00", PLIN: "0.00", TARJETA: "0.00" },
      totalCobrado: "0.00",
      pedidosCobrados: 0,
      vueltoEntregado: "0.00",
      efectivoEsperado: "50.00",
    });
    expect(otraVez.status).toBe(409);
    expect(otraVez.body.error).toMatchObject({ codigo: "CAJA_YA_ABIERTA", turnoId: abierto.body.turno.id });
    // Cada negocio tiene su propia caja; dos aperturas simultáneas: entra una
    expect([s1.status, s2.status].sort()).toEqual([201, 409]);
    expect(await prisma.turnoCaja.count()).toBe(2);
    expect((await actual(caja)).body.turno.id).toBe(abierto.body.turno.id);
  });
});

describe("POST /api/pedidos/:id/pagos", () => {
  it("sin caja abierta responde 409 y no registra nada", async () => {
    const pedido = await pedidoDeMesa();

    const res = await pagar(caja, pedido.id, { pagos: [{ metodo: "YAPE", monto: 53 }] });

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("SIN_CAJA_ABIERTA");
    expect(await prisma.pago.count()).toBe(0);
  });

  it("el pago completo marca el pedido como pagado y libera la mesa", async () => {
    await abrir(caja);
    const pedido = await pedidoDeMesa();
    expect((await mesas())[0].estado).toBe("ocupada");

    const res = await pagar(caja, pedido.id, { pagos: [{ metodo: "YAPE", monto: 53, referencia: "OP-123456" }] });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      saldoPendiente: "0.00",
      vuelto: "0.00",
      pagos: [{ metodo: "YAPE", monto: "53.00", recibido: null, vuelto: "0.00", referencia: "OP-123456" }],
      pedido: { pagado: true, total: "53.00", totalPagado: "53.00", saldoPendiente: "0.00" },
    });
    expect(res.body.pedido.pagadoEn).not.toBeNull();
    expect((await mesas())[0]).toMatchObject({ estado: "libre", pedido: null });

    // La mesa ya admite un pedido nuevo, y el pagado no admite más cobros ni rondas
    const nuevo = await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.leche }] });
    const otroPago = await pagar(caja, pedido.id, { pagos: [{ metodo: "YAPE", monto: 1 }] });
    expect(nuevo.status).toBe(201);
    expect(otroPago.status).toBe(409);
    expect(otroPago.body.error.codigo).toBe("PEDIDO_PAGADO");
  });

  it("pago mixto: Yape + efectivo con vuelto, y el resumen de caja lo refleja", async () => {
    await abrir(caja, 50);
    const pedido = await pedidoDeMesa();

    const res = await pagar(caja, pedido.id, {
      pagos: [
        { metodo: "YAPE", monto: 30 },
        { metodo: "EFECTIVO", monto: 23, recibido: 50 },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.vuelto).toBe("27.00");
    expect(res.body.pagos).toMatchObject([
      { metodo: "YAPE", monto: "30.00", recibido: null, vuelto: "0.00" },
      { metodo: "EFECTIVO", monto: "23.00", recibido: "50.00", vuelto: "27.00" },
    ]);
    expect(res.body.pedido.pagado).toBe(true);

    expect((await actual(caja)).body.turno).toMatchObject({
      totalesPorMetodo: { EFECTIVO: "23.00", YAPE: "30.00", PLIN: "0.00", TARJETA: "0.00" },
      totalCobrado: "53.00",
      pedidosCobrados: 1,
      vueltoEntregado: "27.00",
      efectivoEsperado: "73.00", // 50 iniciales + 23 en efectivo (el vuelto ya salió)
    });
  });

  it("pagos parciales sucesivos: el pedido queda pagado al completar el total", async () => {
    await abrir(caja);
    const pedido = await pedidoDeMesa();

    const primero = await pagar(caja, pedido.id, { pagos: [{ metodo: "PLIN", monto: 20 }] });
    expect(primero.body).toMatchObject({ saldoPendiente: "33.00", pedido: { pagado: false, totalPagado: "20.00" } });
    expect((await mesas())[0].estado).toBe("ocupada");

    const segundo = await pagar(caja, pedido.id, { pagos: [{ metodo: "TARJETA", monto: 33 }] });
    expect(segundo.body).toMatchObject({ saldoPendiente: "0.00", pedido: { pagado: true } });
    expect((await actual(caja)).body.turno.pedidosCobrados).toBe(1);
  });

  it("rechaza un pago que supera el saldo pendiente", async () => {
    await abrir(caja);
    const pedido = await pedidoDeMesa();
    await pagar(caja, pedido.id, { pagos: [{ metodo: "YAPE", monto: 40 }] });

    const exceso = await pagar(caja, pedido.id, { pagos: [{ metodo: "YAPE", monto: 13.01 }] });
    const excesoMixto = await pagar(caja, pedido.id, {
      pagos: [{ metodo: "YAPE", monto: 10 }, { metodo: "EFECTIVO", monto: 5 }],
    });

    for (const res of [exceso, excesoMixto]) {
      expect(res.status).toBe(409);
      expect(res.body.error).toMatchObject({ codigo: "PAGO_EXCEDE_SALDO", saldoPendiente: "13.00" });
    }
    expect(await prisma.pago.count()).toBe(1);
    expect((await cuenta(caja, pedido.id)).body.cuenta).toMatchObject({ totalPagado: "40.00", saldoPendiente: "13.00", pagado: false });
  });

  it("efectivo: calcula el vuelto y exige recibido >= monto; otros métodos no llevan recibido", async () => {
    await abrir(caja);
    const pedido = await pedidoDeMesa();

    const recibidoMenor = await pagar(caja, pedido.id, { pagos: [{ metodo: "EFECTIVO", monto: 53, recibido: 50 }] });
    const yapeConRecibido = await pagar(caja, pedido.id, { pagos: [{ metodo: "YAPE", monto: 53, recibido: 60 }] });
    const montoCero = await pagar(caja, pedido.id, { pagos: [{ metodo: "EFECTIVO", monto: 0 }] });
    const sinPagos = await pagar(caja, pedido.id, { pagos: [] });
    expect([recibidoMenor.status, yapeConRecibido.status, montoCero.status, sinPagos.status]).toEqual([400, 400, 400, 400]);
    expect(recibidoMenor.body.error.detalles[0]).toEqual({ campo: "pagos.0.recibido", mensaje: "Lo recibido no puede ser menor que el monto" });
    expect(await prisma.pago.count()).toBe(0);

    const conVuelto = await pagar(caja, pedido.id, { pagos: [{ metodo: "EFECTIVO", monto: 33, recibido: 100 }] });
    const exacto = await pagar(caja, pedido.id, { pagos: [{ metodo: "EFECTIVO", monto: 20 }] }); // sin recibido = pago exacto

    expect(conVuelto.body).toMatchObject({ vuelto: "67.00", pagos: [{ recibido: "100.00", vuelto: "67.00" }] });
    expect(exacto.body).toMatchObject({ vuelto: "0.00", pagos: [{ recibido: "20.00", vuelto: "0.00" }], pedido: { pagado: true } });
    expect((await actual(caja)).body.turno).toMatchObject({ vueltoEntregado: "67.00", efectivoEsperado: "103.00" });
  });

  it("división por items: cada quien paga sus platos", async () => {
    await abrir(caja);
    const pedido = await pedidoDeMesa();
    const pagados = async () =>
      Object.fromEntries((await cuenta(caja, pedido.id)).body.cuenta.items.map((i: { nombreProducto: string; pagado: boolean }) => [i.nombreProducto, i.pagado]));

    const antes = (await cuenta(mozo, pedido.id)).body.cuenta;
    expect(antes).toMatchObject({ total: "53.00", totalPagado: "0.00", saldoPendiente: "53.00", pagado: false });
    expect(antes.items).toMatchObject([
      { nombreProducto: "Ceviche Simple", cantidad: 2, precioUnitario: "20.00", subtotal: "40.00", pagado: false },
      { nombreProducto: "Chicharrón de Pota — S/ 10", subtotal: "10.00", pagado: false },
      { nombreProducto: "Gaseosa Personal", subtotal: "3.00", pagado: false },
    ]);

    // La suma debe ser exactamente lo que cuestan los items elegidos
    const montoEquivocado = await pagar(caja, pedido.id, { pagos: [{ metodo: "YAPE", monto: 39 }], itemIds: [pedido.ceviche] });
    expect(montoEquivocado.status).toBe(400);
    expect(montoEquivocado.body.error.subtotalItems).toBe("40.00");

    const uno = await pagar(caja, pedido.id, { pagos: [{ metodo: "YAPE", monto: 40 }], itemIds: [pedido.ceviche] });
    expect(uno.status).toBe(201);
    expect(uno.body).toMatchObject({ saldoPendiente: "13.00", pedido: { pagado: false } });
    expect(await pagados()).toEqual({ "Ceviche Simple": true, "Chicharrón de Pota — S/ 10": false, "Gaseosa Personal": false });

    // Un item ya pagado no se cobra dos veces, ni se aceptan items de otro pedido
    const repetido = await pagar(caja, pedido.id, { pagos: [{ metodo: "YAPE", monto: 40 }], itemIds: [pedido.ceviche] });
    const ajeno = await crearPedido(mozo, { items: [{ varianteId: a.v.pota10 }] });
    const itemAjeno = await pagar(caja, pedido.id, { pagos: [{ metodo: "YAPE", monto: 10 }], itemIds: [ajeno.body.pedido.items[0].id] });
    expect(repetido.status).toBe(409);
    expect(repetido.body.error).toMatchObject({ codigo: "ITEM_PAGADO", itemIds: [pedido.ceviche] });
    expect(itemAjeno.status).toBe(404);

    // El resto, con pago mixto sobre dos items
    const dos = await pagar(caja, pedido.id, {
      pagos: [{ metodo: "PLIN", monto: 10 }, { metodo: "EFECTIVO", monto: 3, recibido: 5 }],
      itemIds: [pedido.pota, pedido.gaseosa],
    });
    expect(dos.body).toMatchObject({ vuelto: "2.00", saldoPendiente: "0.00", pedido: { pagado: true } });
    expect(await pagados()).toEqual({ "Ceviche Simple": true, "Chicharrón de Pota — S/ 10": true, "Gaseosa Personal": true });
    expect((await mesas())[0].estado).toBe("libre");
  });

  it("un item ya cobrado no se puede cancelar", async () => {
    await abrir(caja);
    const pedido = await pedidoDeMesa();
    await pagar(caja, pedido.id, { pagos: [{ metodo: "YAPE", monto: 10 }], itemIds: [pedido.pota] });

    const res = await request(app).patch(`/api/pedidos/${pedido.id}/items/${pedido.pota}/cancelar`).set(conToken(caja));

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("ITEM_PAGADO");
  });

  it("otro negocio no ve la cuenta ni puede cobrar el pedido", async () => {
    await abrir(caja);
    const cajaB = await tokenDe(b, "cocina");
    await abrir(cajaB);
    const pedido = await pedidoDeMesa();

    const respuestas = await Promise.all([
      cuenta(cajaB, pedido.id),
      pagar(cajaB, pedido.id, { pagos: [{ metodo: "YAPE", monto: 53 }] }),
      request(app).get(`/api/pedidos/${pedido.id}/nota-venta`).set(conToken(cajaB)),
    ]);

    for (const res of respuestas) expect(res.status).toBe(404);
    expect(await prisma.pago.count()).toBe(0);
  });
});

describe("GET /api/pedidos/:id/nota-venta", () => {
  it("arma el texto para WhatsApp y el enlace wa.me con prefijo 51", async () => {
    await abrir(caja);
    const { ceviche, leche } = a.productos;
    const { body } = await crearPedido(mozo, {
      tipo: "DELIVERY",
      cliente: { telefono: "987 654 321", nombre: "Rosa", direccion: "Jr. Lima 123" },
      items: [
        { varianteId: a.v.ceviche, cantidad: 2 },
        { varianteId: a.v.combo, componentes: [leche.id, ceviche.id] },
        { varianteId: a.v.gaseosa },
      ],
    });
    // 40 + 25 + 3 = 68; envío 3; 3 tapers = 3; total 74
    await prisma.pedido.update({ where: { id: body.pedido.id }, data: { creadoEn: new Date("2026-10-08T01:30:00Z") } });
    await pagar(caja, body.pedido.id, { pagos: [{ metodo: "YAPE", monto: 50 }, { metodo: "EFECTIVO", monto: 24, recibido: 30 }] });

    const res = await request(app).get(`/api/pedidos/${body.pedido.id}/nota-venta`).set(conToken(mozo));

    expect(res.status).toBe(200);
    expect(res.body.texto).toBe(
      [
        "*Negocio A*",
        "Nota de venta - Pedido #1",
        "07/10/2026, 20:30", // 01:30 UTC del día 8 = 20:30 del día 7 en Lima
        "Delivery: Jr. Lima 123",
        "Cliente: Rosa",
        "",
        "2 x Ceviche Simple: S/ 40.00",
        "1 x Combo Doble: S/ 25.00",
        "   (Leche de Tigre + Ceviche Simple)",
        "1 x Gaseosa Personal: S/ 3.00",
        "",
        "Subtotal: S/ 68.00",
        "Envío: S/ 3.00",
        "Tapers (3): S/ 3.00",
        "*TOTAL: S/ 74.00*",
        "",
        "Pago: Yape S/ 50.00 + Efectivo S/ 24.00",
        "",
        "No es comprobante electrónico",
        "¡Gracias por su preferencia!",
      ].join("\n"),
    );

    const url = new URL(res.body.whatsappUrl);
    expect(res.body.whatsappUrl.startsWith("https://wa.me/51987654321?text=")).toBe(true);
    expect(url.searchParams.get("text")).toBe(res.body.texto);
    expect(res.body.whatsappUrl).not.toContain(" ");
  });

  it("sin teléfono no hay enlace; sin pagos el pago figura como pendiente", async () => {
    const pedido = await pedidoDeMesa();

    const res = await request(app).get(`/api/pedidos/${pedido.id}/nota-venta`).set(conToken(mozo));

    expect(res.body.whatsappUrl).toBeNull();
    expect(res.body.texto).toContain("Mesa 1");
    expect(res.body.texto).toContain("Pago: pendiente");
    expect(res.body.texto).toContain("No es comprobante electrónico");
    expect(res.body.texto).not.toContain("Envío");
    expect(res.body.texto).not.toContain("Tapers");
  });
});

describe("POST /api/caja/cerrar", () => {
  it("guarda el cierre y devuelve el resumen con la diferencia (contado − esperado)", async () => {
    await abrir(caja, 50);
    const pedido = await pedidoDeMesa();
    await pagar(caja, pedido.id, { pagos: [{ metodo: "EFECTIVO", monto: 33, recibido: 40 }, { metodo: "YAPE", monto: 20 }] });

    const res = await cerrar(caja, { efectivoContado: 80.5, observacion: "Faltó sencillo" });

    expect(res.status).toBe(200);
    expect(res.body.turno).toMatchObject({
      abierto: false,
      cerradoPor: { nombre: "cocina" },
      montoInicial: "50.00",
      totalesPorMetodo: { EFECTIVO: "33.00", YAPE: "20.00" },
      totalCobrado: "53.00",
      pedidosCobrados: 1,
      vueltoEntregado: "7.00",
      efectivoEsperado: "83.00",
      efectivoContado: "80.50",
      diferencia: "-2.50",
      observacion: "Faltó sencillo",
    });
    expect(res.body.turno.cerradoEn).not.toBeNull();
    expect(res.body).toMatchObject({ pedidosConPagoParcial: [], aviso: null });

    // Ya no hay caja abierta: no se cobra ni se cierra de nuevo, pero se puede abrir otra
    const otro = await crearPedido(mozo, { items: [{ varianteId: a.v.gaseosa }] });
    expect((await actual(caja)).body).toEqual({ turno: null });
    expect((await pagar(caja, otro.body.pedido.id, { pagos: [{ metodo: "YAPE", monto: 3 }] })).status).toBe(409);
    expect((await cerrar(caja, { efectivoContado: 0 })).status).toBe(409);
    const nuevo = await abrir(caja, 20);
    expect(nuevo.status).toBe(201);
    expect(nuevo.body.turno).toMatchObject({ totalCobrado: "0.00", efectivoEsperado: "20.00" });
  });

  it("con sobrante la diferencia es positiva", async () => {
    await abrir(caja, 50);

    const res = await cerrar(caja, { efectivoContado: 51 });

    expect(res.body.turno).toMatchObject({ efectivoEsperado: "50.00", diferencia: "1.00", observacion: null });
  });

  it("avisa si quedan pedidos con pago parcial, pero permite cerrar", async () => {
    await abrir(caja, 0);
    const pedido = await pedidoDeMesa();
    await pagar(caja, pedido.id, { pagos: [{ metodo: "EFECTIVO", monto: 20 }] });
    await crearPedido(mozo, { items: [{ varianteId: a.v.leche }] }); // sin pagos: no es "parcial"

    const res = await cerrar(caja, { efectivoContado: 20 });

    expect(res.status).toBe(200);
    expect(res.body.turno).toMatchObject({ abierto: false, diferencia: "0.00" });
    expect(res.body.pedidosConPagoParcial).toEqual([
      { id: pedido.id, numero: 1, total: "53.00", totalPagado: "20.00", saldoPendiente: "33.00" },
    ]);
    expect(res.body.aviso).toBe("La caja se cerró con 1 pedido(s) con pago parcial pendiente de cobrar");
  });
});
