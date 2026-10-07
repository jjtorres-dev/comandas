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
let cocina: string;

beforeEach(async () => {
  await limpiarBase();
  a = await crearNegocio("Negocio A", "negocio-a");
  b = await crearNegocio("Negocio B", "negocio-b");
  [mozo, cocina] = await Promise.all([tokenDe(a, "mozo"), tokenDe(a, "cocina")]);
});

afterAll(() => prisma.$disconnect());

const patch = (token: string, ruta: string, cuerpo: object) =>
  request(app).patch(`/api/pedidos/${ruta}`).set(conToken(token)).send(cuerpo);

const buscarCliente = (token: string, telefono: string) =>
  request(app).get("/api/clientes/buscar").query({ telefono }).set(conToken(token));

const rosa = { telefono: "+51 987 654 321", nombre: "Rosa", direccion: "Jr. Lima 123", referencia: "Portón verde" };

// 2 ceviches (cocina) + 1 gaseosa (bebidas) = S/ 43
const dosCevichesYGaseosa = [{ varianteId: "", cantidad: 2 }, { varianteId: "" }];
beforeEach(() => {
  dosCevichesYGaseosa[0].varianteId = a.v.ceviche;
  dosCevichesYGaseosa[1].varianteId = a.v.gaseosa;
});

describe("POST /api/pedidos — DELIVERY", () => {
  it("con cliente nuevo: lo crea, copia la entrega y aplica envío y tapers por defecto", async () => {
    const res = await crearPedido(mozo, { tipo: "DELIVERY", cliente: rosa, items: dosCevichesYGaseosa });

    expect(res.status).toBe(201);
    expect(res.body.pedido).toMatchObject({
      tipo: "DELIVERY",
      mesa: null,
      cliente: { nombre: "Rosa", telefono: "987654321" },
      direccionEntrega: "Jr. Lima 123",
      referenciaEntrega: "Portón verde",
      subtotal: "43.00",
      costoEnvio: "3.00", // Negocio.costoEnvioDefault
      cantidadTapers: 2, // solo los platos de cocina; la gaseosa no lleva
      cargoTapers: "2.00",
      total: "48.00",
    });

    const clientes = await prisma.cliente.findMany();
    expect(clientes).toHaveLength(1);
    expect(clientes[0]).toMatchObject({ negocioId: a.negocio.id, telefono: "987654321", nombre: "Rosa", direccion: "Jr. Lima 123" });

    // Autocompletar: se encuentra con cualquier formato del teléfono, y solo en su negocio
    const encontrado = await buscarCliente(mozo, "987 654 321");
    const enOtroNegocio = await buscarCliente(await tokenDe(b, "mozo"), "987654321");
    const desconocido = await buscarCliente(mozo, "900000000");
    expect(encontrado.body.cliente).toEqual({
      id: clientes[0].id,
      telefono: "987654321",
      nombre: "Rosa",
      direccion: "Jr. Lima 123",
      referencia: "Portón verde",
    });
    expect(enOtroNegocio.body).toEqual({ cliente: null });
    expect(desconocido.body).toEqual({ cliente: null });
    expect((await buscarCliente(mozo, "abc")).status).toBe(400);
  });

  it("con cliente existente: lo actualiza sin duplicarlo ni alterar pedidos anteriores", async () => {
    const primero = await crearPedido(mozo, { tipo: "DELIVERY", cliente: rosa, items: [{ varianteId: a.v.ceviche }] });

    const segundo = await crearPedido(mozo, {
      tipo: "DELIVERY",
      cliente: { telefono: "987654321", direccion: "Av. Perú 456" }, // se mudó; no repite el nombre
      items: [{ varianteId: a.v.leche }],
    });

    expect(segundo.status).toBe(201);
    expect(segundo.body.pedido).toMatchObject({
      cliente: { nombre: "Rosa", telefono: "987654321" },
      direccionEntrega: "Av. Perú 456",
      referenciaEntrega: null,
    });

    const clientes = await prisma.cliente.findMany();
    expect(clientes).toHaveLength(1);
    expect(clientes[0]).toMatchObject({ nombre: "Rosa", direccion: "Av. Perú 456", referencia: null });

    const anterior = await prisma.pedido.findUniqueOrThrow({ where: { id: primero.body.pedido.id } });
    expect(anterior).toMatchObject({ direccionEntrega: "Jr. Lima 123", referenciaEntrega: "Portón verde" });
    expect(anterior.clienteId).toBe(clientes[0].id);
  });

  it("acepta costoEnvio y cantidadTapers explícitos (incluido 0)", async () => {
    const res = await crearPedido(mozo, {
      tipo: "DELIVERY",
      cliente: rosa,
      costoEnvio: 5.5,
      cantidadTapers: 0,
      items: dosCevichesYGaseosa,
    });
    const gratis = await crearPedido(mozo, { tipo: "DELIVERY", cliente: rosa, costoEnvio: 0, items: dosCevichesYGaseosa });

    expect(res.body.pedido).toMatchObject({ costoEnvio: "5.50", cantidadTapers: 0, cargoTapers: "0.00", total: "48.50" });
    expect(gratis.body.pedido).toMatchObject({ costoEnvio: "0.00", cantidadTapers: 2, total: "45.00" });
  });

  it("exige teléfono y dirección, y limita el envío a 0–20", async () => {
    const items = [{ varianteId: a.v.ceviche }];
    const sinCliente = await crearPedido(mozo, { tipo: "DELIVERY", items });
    const sinDireccion = await crearPedido(mozo, { tipo: "DELIVERY", cliente: { telefono: "987654321" }, items });
    const sinTelefono = await crearPedido(mozo, { tipo: "DELIVERY", cliente: { direccion: "Jr. Lima 123" }, items });
    const envioCaro = await crearPedido(mozo, { tipo: "DELIVERY", cliente: rosa, costoEnvio: 20.01, items });
    const envioNegativo = await crearPedido(mozo, { tipo: "DELIVERY", cliente: rosa, costoEnvio: -1, items });

    for (const res of [sinCliente, sinDireccion, sinTelefono, envioCaro, envioNegativo]) expect(res.status).toBe(400);
    expect(sinCliente.body.error.detalles.map((d: { campo: string }) => d.campo)).toEqual(["cliente.telefono", "cliente.direccion"]);
    expect(await prisma.pedido.count()).toBe(0);
    expect(await prisma.cliente.count()).toBe(0);
  });
});

describe("POST /api/pedidos — PARA_LLEVAR y MESA", () => {
  it("para llevar: cliente opcional, sin envío y con tapers automáticos", async () => {
    const anonimo = await crearPedido(mozo, { tipo: "PARA_LLEVAR", items: dosCevichesYGaseosa });
    const conNombre = await crearPedido(mozo, { tipo: "PARA_LLEVAR", cliente: { nombre: "Juan" }, costoEnvio: 5, items: dosCevichesYGaseosa });
    const conTelefono = await crearPedido(mozo, {
      tipo: "PARA_LLEVAR",
      cliente: { nombre: "Ana", telefono: "912345678" },
      cantidadTapers: 5,
      items: dosCevichesYGaseosa,
    });

    expect(anonimo.body.pedido).toMatchObject({ cliente: null, costoEnvio: "0.00", cantidadTapers: 2, cargoTapers: "2.00", total: "45.00" });
    // El envío no aplica a para llevar aunque venga en el cuerpo
    expect(conNombre.body.pedido).toMatchObject({ cliente: { nombre: "Juan", telefono: null }, costoEnvio: "0.00", total: "45.00" });
    expect(conTelefono.body.pedido).toMatchObject({
      cliente: { nombre: "Ana", telefono: "912345678" },
      direccionEntrega: null,
      cantidadTapers: 5,
      cargoTapers: "5.00",
      total: "48.00",
    });

    // Solo se guarda como Cliente quien dejó teléfono
    expect((await prisma.cliente.findMany()).map((c) => c.nombre)).toEqual(["Ana"]);
  });

  it("tapers automáticos: suma las cantidades de los items de cocina, combos incluidos", async () => {
    const { ceviche, leche } = a.productos;
    const res = await crearPedido(mozo, {
      tipo: "PARA_LLEVAR",
      items: [
        { varianteId: a.v.ceviche, cantidad: 3 },
        { varianteId: a.v.gaseosa, cantidad: 4 },
        { varianteId: a.v.pota10, cantidad: 2 },
        { varianteId: a.v.combo, cantidad: 1, componentes: [ceviche.id, leche.id] },
      ],
    });

    // 3 + 2 + 1 = 6 tapers (el combo cuenta por su cantidad); 60 + 12 + 20 + 25 = 117
    expect(res.body.pedido).toMatchObject({ cantidadTapers: 6, cargoTapers: "6.00", subtotal: "117.00", total: "123.00" });

    // El precio del taper sale del negocio
    await prisma.negocio.update({ where: { id: a.negocio.id }, data: { precioTaper: 1.5 } });
    const otro = await crearPedido(mozo, { tipo: "PARA_LLEVAR", items: [{ varianteId: a.v.ceviche, cantidad: 2 }] });
    expect(otro.body.pedido).toMatchObject({ cantidadTapers: 2, cargoTapers: "3.00", total: "43.00" });
  });

  it("en MESA el envío y los tapers siempre son 0", async () => {
    const res = await crearPedido(mozo, {
      mesaId: a.mesas[0].id,
      cliente: rosa,
      costoEnvio: 5,
      cantidadTapers: 4,
      items: dosCevichesYGaseosa,
    });

    expect(res.status).toBe(201);
    expect(res.body.pedido).toMatchObject({ cliente: null, costoEnvio: "0.00", cantidadTapers: 0, cargoTapers: "0.00", total: "43.00" });
    expect(await prisma.cliente.count()).toBe(0);
  });
});

describe("PATCH /api/pedidos/:id/cargos", () => {
  it("LOCAL ajusta envío, tapers y descuento, y el total se recalcula", async () => {
    const { body } = await crearPedido(mozo, { tipo: "DELIVERY", cliente: rosa, items: dosCevichesYGaseosa }); // 48

    const res = await patch(cocina, `${body.pedido.id}/cargos`, { costoEnvio: 4, cantidadTapers: 3, descuento: 5 });
    const soloDescuento = await patch(cocina, `${body.pedido.id}/cargos`, { descuento: 0 });

    expect(res.status).toBe(200);
    expect(res.body.pedido).toMatchObject({ costoEnvio: "4.00", cantidadTapers: 3, cargoTapers: "3.00", descuento: "5.00", total: "45.00" });
    // Lo que no se envía no cambia
    expect(soloDescuento.body.pedido).toMatchObject({ costoEnvio: "4.00", cantidadTapers: 3, descuento: "0.00", total: "50.00" });
  });

  it("rechaza cargos que no aplican al tipo, descuentos excesivos y pedidos con pagos", async () => {
    const mesa = await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.ceviche }] }); // 20
    const id = mesa.body.pedido.id;

    const envioEnMesa = await patch(cocina, `${id}/cargos`, { costoEnvio: 3 });
    const tapersEnMesa = await patch(cocina, `${id}/cargos`, { cantidadTapers: 1 });
    const descuentoExcesivo = await patch(cocina, `${id}/cargos`, { descuento: 20.5 });
    const vacio = await patch(cocina, `${id}/cargos`, {});
    const descuentoValido = await patch(cocina, `${id}/cargos`, { descuento: 2 });

    expect([envioEnMesa.status, tapersEnMesa.status, descuentoExcesivo.status, vacio.status]).toEqual([400, 400, 400, 400]);
    expect(descuentoValido.body.pedido.total).toBe("18.00");

    await request(app).post("/api/caja/abrir").set(conToken(cocina)).send({ montoInicial: 0 });
    await request(app).post(`/api/pedidos/${id}/pagos`).set(conToken(cocina)).send({ pagos: [{ metodo: "YAPE", monto: 5 }] });
    const conPagos = await patch(cocina, `${id}/cargos`, { descuento: 0 });

    expect(conPagos.status).toBe(409);
    expect(conPagos.body.error.codigo).toBe("PEDIDO_CON_PAGOS");
  });
});

describe("despacho de delivery", () => {
  it("GET /api/repartidores lista los activos del negocio", async () => {
    await prisma.repartidor.create({ data: { negocioId: a.negocio.id, nombre: "Inactivo", activo: false } });

    const res = await request(app).get("/api/repartidores").set(conToken(mozo));

    expect(res.status).toBe(200);
    expect(res.body.repartidores).toEqual([{ id: a.repartidor.id, nombre: "Motorizado", telefono: null }]);
  });

  it("asigna repartidor solo a pedidos de delivery y solo del propio negocio", async () => {
    const delivery = await crearPedido(mozo, { tipo: "DELIVERY", cliente: rosa, items: [{ varianteId: a.v.ceviche }] });
    const mesa = await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.ceviche }] });
    const id = delivery.body.pedido.id;

    const asignado = await patch(cocina, `${id}/repartidor`, { repartidorId: a.repartidor.id });
    const enMesa = await patch(cocina, `${mesa.body.pedido.id}/repartidor`, { repartidorId: a.repartidor.id });
    const ajeno = await patch(cocina, `${id}/repartidor`, { repartidorId: b.repartidor.id });
    const desdeOtroNegocio = await patch(await tokenDe(b, "cocina"), `${id}/repartidor`, { repartidorId: b.repartidor.id });

    expect(asignado.status).toBe(200);
    expect(asignado.body.pedido.repartidor).toEqual({ id: a.repartidor.id, nombre: "Motorizado" });
    expect(enMesa.status).toBe(409);
    expect(enMesa.body.error.codigo).toBe("NO_ES_DELIVERY");
    expect([ajeno.status, desdeOtroNegocio.status]).toEqual([404, 404]);

    const quitado = await patch(cocina, `${id}/repartidor`, { repartidorId: null });
    expect(quitado.body.pedido.repartidor).toBeNull();
  });

  it("EN_CAMINO solo para delivery que está LISTO; ENTREGADO cierra todos los items", async () => {
    const delivery = await crearPedido(mozo, { tipo: "DELIVERY", cliente: rosa, items: dosCevichesYGaseosa });
    const id = delivery.body.pedido.id;

    const antesDeTiempo = await patch(cocina, `${id}/estado`, { estado: "EN_CAMINO" });
    const entregarSinTerminar = await patch(cocina, `${id}/estado`, { estado: "ENTREGADO" });
    expect([antesDeTiempo.status, entregarSinTerminar.status]).toEqual([409, 409]);
    expect(antesDeTiempo.body.error.codigo).toBe("PEDIDO_NO_LISTO");

    await patch(cocina, `${id}/items/estado`, { areaId: a.areas.cocina.id, estado: "LISTO" });
    await patch(cocina, `${id}/items/estado`, { areaId: a.areas.bebidas.id, estado: "LISTO" });
    const enCamino = await patch(cocina, `${id}/estado`, { estado: "EN_CAMINO" });
    expect(enCamino.status).toBe(200);
    expect(enCamino.body.pedido.estado).toBe("EN_CAMINO");

    // Sigue apareciendo entre los activos mientras está en camino
    const activos = await request(app).get("/api/pedidos/activos").set(conToken(cocina));
    expect(activos.body.pedidos.map((p: { estado: string }) => p.estado)).toEqual(["EN_CAMINO"]);

    const entregado = await patch(cocina, `${id}/estado`, { estado: "ENTREGADO" });
    expect(entregado.body.pedido.estado).toBe("ENTREGADO");
    expect(entregado.body.pedido.items.every((i: { estado: string }) => i.estado === "ENTREGADO")).toBe(true);

    const otroEstado = await patch(cocina, `${id}/estado`, { estado: "LISTO" });
    expect(otroEstado.status).toBe(400);
  });

  it("un pedido que no es delivery no sale EN_CAMINO", async () => {
    const paraLlevar = await crearPedido(mozo, { tipo: "PARA_LLEVAR", items: [{ varianteId: a.v.ceviche }] });
    const id = paraLlevar.body.pedido.id;
    await patch(cocina, `${id}/items/estado`, { areaId: a.areas.cocina.id, estado: "LISTO" });

    const enCamino = await patch(cocina, `${id}/estado`, { estado: "EN_CAMINO" });
    const entregado = await patch(mozo, `${id}/estado`, { estado: "ENTREGADO" });

    expect(enCamino.status).toBe(409);
    expect(enCamino.body.error.codigo).toBe("NO_ES_DELIVERY");
    expect(entregado.body.pedido.estado).toBe("ENTREGADO");
  });
});
