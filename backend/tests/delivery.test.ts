import { randomUUID } from "node:crypto";
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
      cantidadTapers: 2, // uno por ceviche; la gaseosa no lleva
      tapersManual: false,
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
      distrito: "Tarapoto",
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

    expect(res.body.pedido).toMatchObject({ costoEnvio: "5.50", cantidadTapers: 0, tapersManual: true, cargoTapers: "0.00", total: "48.50" });
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

  it("tapers automáticos por producto: suma cantidad × Producto.tapers", async () => {
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

    // 3 ceviches×1 + 4 gaseosas×0 + 2 potas×1 + 1 combo doble×2 = 7 tapers; 60 + 12 + 20 + 25 = 117
    expect(res.body.pedido).toMatchObject({ cantidadTapers: 7, tapersManual: false, cargoTapers: "7.00", subtotal: "117.00", total: "124.00" });

    // Lo decide el producto, no el área: una bebida puede llevar taper y un plato no
    await prisma.producto.update({ where: { id: a.productos.gaseosa.id }, data: { tapers: 1 } });
    await prisma.producto.update({ where: { id: a.productos.pota.id }, data: { tapers: 0 } });
    await prisma.producto.update({ where: { id: a.productos.combo.id }, data: { tapers: 3 } });
    const cambiado = await crearPedido(mozo, {
      tipo: "DELIVERY",
      cliente: rosa,
      items: [
        { varianteId: a.v.gaseosa, cantidad: 4 },
        { varianteId: a.v.pota18, cantidad: 2 },
        { varianteId: a.v.combo, cantidad: 2, componentes: [ceviche.id, ceviche.id] },
      ],
    });
    expect(cambiado.body.pedido).toMatchObject({ cantidadTapers: 10, cargoTapers: "10.00" }); // 4 + 0 + 2×3

    const carta = await request(app).get("/api/carta").set(conToken(mozo));
    const tapersEnCarta = Object.fromEntries(carta.body.categorias[0].productos.map((p: { nombre: string; tapers: number }) => [p.nombre, p.tapers]));
    expect(tapersEnCarta).toMatchObject({ "Ceviche Simple": 1, "Gaseosa Personal": 1, "Chicharrón de Pota": 0, "Combo Doble": 3 });

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

describe("recálculo de tapers", () => {
  const ronda = (pedidoId: string, items: object[]) =>
    request(app)
      .post(`/api/pedidos/${pedidoId}/items`)
      .set(conToken(mozo))
      .send({ idRonda: randomUUID(), items: items.map((i) => ({ cantidad: 1, notas: [], ...i })) });
  const cancelar = (pedidoId: string, itemId: string) =>
    request(app).patch(`/api/pedidos/${pedidoId}/items/${itemId}/cancelar`).set(conToken(mozo));

  it("se recalculan al agregar rondas y al cancelar items", async () => {
    const { ceviche, leche } = a.productos;
    const creado = await crearPedido(mozo, { tipo: "PARA_LLEVAR", items: [{ varianteId: a.v.ceviche, cantidad: 2 }] });
    const { id, items } = creado.body.pedido;
    expect(creado.body.pedido).toMatchObject({ cantidadTapers: 2, cargoTapers: "2.00", total: "42.00" });

    // Ronda: combo doble (2 tapers) + gaseosa (0) + leche (1)
    const conRonda = await ronda(id, [
      { varianteId: a.v.combo, componentes: [ceviche.id, leche.id] },
      { varianteId: a.v.gaseosa },
      { varianteId: a.v.leche },
    ]);
    expect(conRonda.status).toBe(201);
    // 40 + 25 + 3 + 12 = 80; 5 tapers
    expect(conRonda.body.pedido).toMatchObject({ cantidadTapers: 5, tapersManual: false, cargoTapers: "5.00", subtotal: "80.00", total: "85.00" });

    // Reintentar la misma ronda no vuelve a sumar
    const sinCambios = await request(app)
      .post(`/api/pedidos/${id}/items`)
      .set(conToken(mozo))
      .send({ idRonda: conRonda.body.pedido.items[1].idRonda, items: [{ varianteId: a.v.leche, cantidad: 1, notas: [] }] });
    expect(sinCambios.body.pedido).toMatchObject({ cantidadTapers: 5, total: "85.00" });

    // Cancelar los 2 ceviches quita sus 2 tapers; cancelar la gaseosa no cambia nada
    const sinCeviches = await cancelar(id, items[0].id);
    expect(sinCeviches.body.pedido).toMatchObject({ cantidadTapers: 3, cargoTapers: "3.00", subtotal: "40.00", total: "43.00" });
    const gaseosa = sinCeviches.body.pedido.items.find((i: { nombreProducto: string }) => i.nombreProducto === "Gaseosa Personal");
    const sinGaseosa = await cancelar(id, gaseosa.id);
    expect(sinGaseosa.body.pedido).toMatchObject({ cantidadTapers: 3, total: "40.00" });
  });

  it("en delivery el recálculo conserva el costo de envío y usa el precio del taper del negocio", async () => {
    await prisma.negocio.update({ where: { id: a.negocio.id }, data: { precioTaper: 1.5 } });
    const creado = await crearPedido(mozo, { tipo: "DELIVERY", cliente: rosa, costoEnvio: 5, items: [{ varianteId: a.v.ceviche }] });
    expect(creado.body.pedido).toMatchObject({ cantidadTapers: 1, cargoTapers: "1.50", total: "26.50" });

    const conRonda = await ronda(creado.body.pedido.id, [{ varianteId: a.v.pota10, cantidad: 3 }]);

    expect(conRonda.body.pedido).toMatchObject({ costoEnvio: "5.00", cantidadTapers: 4, cargoTapers: "6.00", total: "61.00" });
  });

  it("tapersManual: una cantidad fijada al crear el pedido no se recalcula", async () => {
    const creado = await crearPedido(mozo, { tipo: "PARA_LLEVAR", cantidadTapers: 1, items: [{ varianteId: a.v.ceviche, cantidad: 2 }] });
    const { id, items } = creado.body.pedido;
    expect(creado.body.pedido).toMatchObject({ cantidadTapers: 1, tapersManual: true, cargoTapers: "1.00", total: "41.00" });

    const conRonda = await ronda(id, [{ varianteId: a.v.leche, cantidad: 3 }]);
    const conCancelacion = await cancelar(id, items[0].id);

    expect(conRonda.body.pedido).toMatchObject({ cantidadTapers: 1, tapersManual: true, cargoTapers: "1.00", total: "77.00" });
    expect(conCancelacion.body.pedido).toMatchObject({ cantidadTapers: 1, tapersManual: true, total: "37.00" });
  });

  it("tapersManual: fijarla con /cargos detiene el recálculo; null lo reactiva", async () => {
    const creado = await crearPedido(mozo, { tipo: "DELIVERY", cliente: rosa, items: [{ varianteId: a.v.ceviche, cantidad: 2 }] });
    const { id } = creado.body.pedido;
    expect(creado.body.pedido).toMatchObject({ cantidadTapers: 2, tapersManual: false, total: "45.00" });

    // Un ajuste que no toca los tapers no los vuelve manuales
    const soloEnvio = await patch(cocina, `${id}/cargos`, { costoEnvio: 4 });
    expect(soloEnvio.body.pedido).toMatchObject({ cantidadTapers: 2, tapersManual: false, total: "46.00" });

    const fijado = await patch(cocina, `${id}/cargos`, { cantidadTapers: 6 });
    expect(fijado.body.pedido).toMatchObject({ cantidadTapers: 6, tapersManual: true, cargoTapers: "6.00", total: "50.00" });

    const conRonda = await ronda(id, [{ varianteId: a.v.pota10, cantidad: 2 }]);
    expect(conRonda.body.pedido).toMatchObject({ cantidadTapers: 6, tapersManual: true, cargoTapers: "6.00", total: "70.00" });

    // null = volver al cálculo automático: 2 ceviches + 2 potas
    const automatico = await patch(cocina, `${id}/cargos`, { cantidadTapers: null });
    expect(automatico.status).toBe(200);
    expect(automatico.body.pedido).toMatchObject({ cantidadTapers: 4, tapersManual: false, cargoTapers: "4.00", total: "68.00" });

    const otraRonda = await ronda(id, [{ varianteId: a.v.leche }]);
    expect(otraRonda.body.pedido).toMatchObject({ cantidadTapers: 5, tapersManual: false, total: "81.00" });
  });

  it("en MESA los tapers siguen en 0 aunque se agreguen rondas", async () => {
    const creado = await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.ceviche }] });

    const conRonda = await ronda(creado.body.pedido.id, [{ varianteId: a.v.leche, cantidad: 2 }]);

    expect(conRonda.body.pedido).toMatchObject({ cantidadTapers: 0, tapersManual: false, cargoTapers: "0.00", total: "44.00" });
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
    expect(asignado.body.pedido.repartidor).toMatchObject({ id: a.repartidor.id, nombre: "Motorizado" });
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

describe("pedidos por teléfono: pago previsto, distrito y correcciones", () => {
  const crearDelivery = (extra: object = {}) =>
    crearPedido(cocina, { tipo: "DELIVERY", cliente: rosa, items: dosCevichesYGaseosa, ...extra });
  const get = (token: string, ruta: string) => request(app).get(`/api/${ruta}`).set(conToken(token));

  it("GET /carta trae los datos de reparto del negocio", async () => {
    const res = await get(mozo, "carta");
    expect(res.body.reparto).toEqual({ costoEnvioDefault: "3.00", precioTaper: "1.00", distritos: ["Tarapoto", "Morales"], region: "San Martín, Perú" });
  });

  it("guarda el pago previsto y calcula el vuelto que lleva el motorizado", async () => {
    // 43 + 3 de envío + 2 tapers (las bebidas no llevan) = S/ 48
    const res = await crearDelivery({ pagoPrevisto: { momento: "AL_RECIBIR", metodo: "EFECTIVO", pagaCon: 100 } });
    expect(res.status).toBe(201);
    expect(res.body.pedido).toMatchObject({
      total: "48.00",
      pagado: false,
      totalPagado: "0.00",
      pagoPrevisto: { momento: "AL_RECIBIR", metodo: "EFECTIVO", pagaCon: "100.00", vuelto: "52.00" },
    });

    // "Ya pagó" queda por confirmar: no es un pago, no entra a la caja
    const yape = await crearPedido(cocina, {
      tipo: "PARA_LLEVAR",
      cliente: { telefono: "911222333", nombre: "Luis" },
      items: dosCevichesYGaseosa,
      pagoPrevisto: { momento: "ANTICIPADO", metodo: "YAPE" },
    });
    expect(yape.body.pedido).toMatchObject({ pagado: false, pagoPrevisto: { momento: "ANTICIPADO", metodo: "YAPE", pagaCon: null, vuelto: null } });
    expect(await prisma.pago.count()).toBe(0);

    // Si lo que entrega el cliente no alcanza, no hay vuelto que llevar
    const corto = await crearDelivery({ pagoPrevisto: { momento: "AL_RECIBIR", metodo: "EFECTIVO", pagaCon: 20 } });
    expect(corto.body.pedido.pagoPrevisto).toMatchObject({ pagaCon: "20.00", vuelto: null });

    const invalidos = await Promise.all([
      crearDelivery({ pagoPrevisto: { momento: "ANTICIPADO", metodo: "EFECTIVO" } }),
      crearDelivery({ pagoPrevisto: { momento: "AL_RECIBIR", metodo: "YAPE", pagaCon: 50 } }),
      crearDelivery({ pagoPrevisto: { momento: "DESPUES", metodo: "YAPE" } }),
    ]);
    expect(invalidos.map((r) => r.status)).toEqual([400, 400, 400]);
  });

  it("el distrito se copia al pedido y al cliente; por defecto es el primero del negocio", async () => {
    const sinDistrito = await crearDelivery();
    expect(sinDistrito.body.pedido.distritoEntrega).toBe("Tarapoto");

    const morales = await crearDelivery({ cliente: { ...rosa, distrito: "Morales" } });
    expect(morales.body.pedido.distritoEntrega).toBe("Morales");
    expect((await buscarCliente(cocina, rosa.telefono)).body.cliente).toMatchObject({ distrito: "Morales", direccion: "Jr. Lima 123" });

    const otro = await crearDelivery({ cliente: { ...rosa, distrito: "Lima" } });
    expect(otro.status).toBe(400);
    expect(otro.body.error).toMatchObject({ codigo: "SOLICITUD_INVALIDA", distritos: ["Tarapoto", "Morales"] });
  });

  it("GET /clientes/ultimo-pedido devuelve el último pedido no cancelado del cliente", async () => {
    expect((await get(cocina, "clientes/ultimo-pedido?telefono=987654321")).body).toEqual({ pedido: null });

    const primero = await crearDelivery();
    const segundo = await crearDelivery({ items: [{ varianteId: a.v.pota18, cantidad: 1, notas: ["Ají aparte"] }] });
    const res = await get(cocina, "clientes/ultimo-pedido?telefono=987654321");
    expect(res.body.pedido).toMatchObject({ id: segundo.body.pedido.id, items: [{ varianteId: a.v.pota18, cantidad: 1, notas: ["Ají aparte"] }] });

    // Cancelado el último, vuelve a valer el anterior; otro negocio no ve nada
    await patch(cocina, `${segundo.body.pedido.id}/cancelar`, { motivo: "Se arrepintió" });
    expect((await get(cocina, "clientes/ultimo-pedido?telefono=987654321")).body.pedido.id).toBe(primero.body.pedido.id);
    expect((await get(await tokenDe(b, "cocina"), "clientes/ultimo-pedido?telefono=987654321")).body).toEqual({ pedido: null });
  });

  it("GET /pedidos/por-telefono lista deliveries y para llevar con teléfono, también los ya entregados y pagados", async () => {
    const delivery = await crearDelivery();
    const llevarConTelefono = await crearPedido(cocina, { tipo: "PARA_LLEVAR", cliente: { telefono: "911222333" }, items: dosCevichesYGaseosa });
    await crearPedido(mozo, { tipo: "PARA_LLEVAR", cliente: { nombre: "Sin teléfono" }, items: dosCevichesYGaseosa });
    await crearPedido(mozo, { mesaId: a.mesas[0].id, items: dosCevichesYGaseosa });
    const cancelado = await crearDelivery();
    await patch(cocina, `${cancelado.body.pedido.id}/cancelar`, { motivo: "Número equivocado" });

    // El delivery se prepara, sale, se entrega y se cobra: sale de "activos" pero sigue en el tablero del día
    const id = delivery.body.pedido.id as string;
    await patch(cocina, `${id}/items/estado`, { itemIds: delivery.body.pedido.items.map((i: { id: string }) => i.id), estado: "LISTO" });
    await patch(cocina, `${id}/estado`, { estado: "ENTREGADO" });
    await request(app).post("/api/caja/abrir").set(conToken(cocina)).send({ montoInicial: 0 });
    await request(app).post(`/api/pedidos/${id}/pagos`).set(conToken(cocina)).send({ pagos: [{ metodo: "EFECTIVO", monto: 48 }] });
    const activos = (await get(cocina, "pedidos/activos")).body.pedidos as { id: string }[];
    expect(activos.map((p) => p.id)).not.toContain(id);

    const res = await get(cocina, "pedidos/por-telefono");
    expect(res.status).toBe(200);
    expect(res.body.pedidos.map((p: { id: string }) => p.id)).toEqual([id, llevarConTelefono.body.pedido.id]);
    expect(res.body.pedidos[0]).toMatchObject({ estado: "ENTREGADO", pagado: true });
    expect((await get(await tokenDe(b, "cocina"), "pedidos/por-telefono")).body.pedidos).toEqual([]);
  });

  it("PATCH /:id/entrega corrige dirección, distrito, referencia y pago previsto, y actualiza al cliente", async () => {
    const pedido = (await crearDelivery({ pagoPrevisto: { momento: "ANTICIPADO", metodo: "YAPE" } })).body.pedido;

    const res = await patch(cocina, `${pedido.id}/entrega`, {
      direccion: "Jr. Nuevo 500",
      distrito: "Morales",
      referencia: "",
      pagoPrevisto: { momento: "AL_RECIBIR", metodo: "EFECTIVO", pagaCon: 50 },
    });
    expect(res.status).toBe(200);
    expect(res.body.pedido).toMatchObject({
      direccionEntrega: "Jr. Nuevo 500",
      distritoEntrega: "Morales",
      referenciaEntrega: null,
      pagoPrevisto: { momento: "AL_RECIBIR", metodo: "EFECTIVO", pagaCon: "50.00", vuelto: "2.00" },
    });
    expect((await buscarCliente(cocina, rosa.telefono)).body.cliente).toMatchObject({ direccion: "Jr. Nuevo 500", distrito: "Morales", referencia: null });

    // Pasar a Yape al recibir borra el "paga con"
    const aYape = await patch(cocina, `${pedido.id}/entrega`, { pagoPrevisto: { momento: "AL_RECIBIR", metodo: "YAPE" } });
    expect(aYape.body.pedido.pagoPrevisto).toEqual({ momento: "AL_RECIBIR", metodo: "YAPE", pagaCon: null, vuelto: null });

    expect((await patch(cocina, `${pedido.id}/entrega`, {})).status).toBe(400);
    expect((await patch(cocina, `${pedido.id}/entrega`, { distrito: "Lima" })).status).toBe(400);
    expect((await patch(mozo, `${pedido.id}/entrega`, { direccion: "X" })).status).toBe(403);
    const deMesa = await crearPedido(mozo, { mesaId: a.mesas[0].id, items: dosCevichesYGaseosa });
    expect((await patch(cocina, `${deMesa.body.pedido.id}/entrega`, { direccion: "X" })).body.error.codigo).toBe("NO_ES_DELIVERY");
  });

  it("PATCH /:id/cancelar cancela el pedido con motivo; no si tiene pagos o si ya salió", async () => {
    const pedido = (await crearDelivery()).body.pedido;
    expect((await patch(cocina, `${pedido.id}/cancelar`, {})).status).toBe(400);
    expect((await patch(mozo, `${pedido.id}/cancelar`, { motivo: "No soy caja" })).status).toBe(403);

    const res = await patch(cocina, `${pedido.id}/cancelar`, { motivo: "El cliente ya no lo quiere" });
    expect(res.status).toBe(200);
    expect(res.body.pedido).toMatchObject({ estado: "CANCELADO", total: "3.00", motivoCancelacion: "El cliente ya no lo quiere" });
    expect(res.body.pedido.items.every((i: { estado: string }) => i.estado === "CANCELADO")).toBe(true);
    expect((await patch(cocina, `${pedido.id}/cancelar`, { motivo: "Otra vez" })).body.error.codigo).toBe("PEDIDO_CANCELADO");

    // Con un pago confirmado hay que anularlo primero en Caja
    await request(app).post("/api/caja/abrir").set(conToken(cocina)).send({ montoInicial: 0 });
    const pagado = (await crearDelivery()).body.pedido;
    await request(app).post(`/api/pedidos/${pagado.id}/pagos`).set(conToken(cocina)).send({ pagos: [{ metodo: "YAPE", monto: 48 }] });
    expect((await patch(cocina, `${pagado.id}/cancelar`, { motivo: "Tarde" })).body.error.codigo).toBe("PEDIDO_CON_PAGOS");

    // En camino ya no se cancela
    const enCamino = (await crearDelivery()).body.pedido;
    await patch(cocina, `${enCamino.id}/items/estado`, { itemIds: enCamino.items.map((i: { id: string }) => i.id), estado: "LISTO" });
    await patch(cocina, `${enCamino.id}/estado`, { estado: "EN_CAMINO" });
    expect((await patch(cocina, `${enCamino.id}/cancelar`, { motivo: "Tarde" })).body.error.codigo).toBe("PEDIDO_YA_SALIO");
  });
});
