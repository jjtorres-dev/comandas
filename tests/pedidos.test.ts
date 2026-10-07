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
let admin: string;
let mozoB: string;

beforeEach(async () => {
  await limpiarBase();
  a = await crearNegocio("Negocio A", "negocio-a");
  b = await crearNegocio("Negocio B", "negocio-b");
  [mozo, cocina, admin, mozoB] = await Promise.all([tokenDe(a, "mozo"), tokenDe(a, "cocina"), tokenDe(a, "admin"), tokenDe(b, "mozo")]);
});

afterAll(() => prisma.$disconnect());

const cambiarEstado = (token: string, pedidoId: string, cuerpo: object) =>
  request(app).patch(`/api/pedidos/${pedidoId}/items/estado`).set(conToken(token)).send(cuerpo);

const cancelar = (token: string, pedidoId: string, itemId: string) =>
  request(app).patch(`/api/pedidos/${pedidoId}/items/${itemId}/cancelar`).set(conToken(token));

describe("GET /api/carta", () => {
  it("devuelve categorías, productos, variantes, opciones de combo y notas del negocio", async () => {
    await prisma.notaRapida.create({ data: { negocioId: a.negocio.id, texto: "Sin cebolla" } });
    await prisma.notaRapida.create({ data: { negocioId: b.negocio.id, texto: "Nota de B" } });
    await prisma.producto.update({ where: { id: a.productos.arroz.id }, data: { activo: false } });

    const res = await request(app).get("/api/carta").set(conToken(mozo));

    expect(res.status).toBe(200);
    expect(res.body.categorias).toHaveLength(1);
    const productos = res.body.categorias[0].productos;
    expect(productos.map((p: { nombre: string }) => p.nombre)).toEqual([
      "Ceviche Simple",
      "Leche de Tigre",
      "Chicharrón de Pota",
      "Gaseosa Personal",
      "Combo Doble",
    ]);
    expect(productos[2].variantes).toEqual([
      { id: a.v.pota10, nombre: "S/ 10", precio: "10.00" },
      { id: a.v.pota18, nombre: "S/ 18", precio: "18.00" },
    ]);
    expect(productos[4]).toMatchObject({
      esCombo: true,
      comboCantidad: 2,
      opcionesCombo: [
        { productoId: a.productos.ceviche.id, nombre: "Ceviche Simple" },
        { productoId: a.productos.leche.id, nombre: "Leche de Tigre" },
      ],
    });
    expect(res.body.notasRapidas.map((n: { texto: string }) => n.texto)).toEqual(["Sin cebolla"]);
  });
});

describe("POST /api/pedidos", () => {
  it("toma precios y nombres de la base, no del cliente", async () => {
    const res = await request(app)
      .post("/api/pedidos")
      .set(conToken(mozo))
      .send({
        tipo: "MESA",
        mesaId: a.mesas[0].id,
        idCliente: randomUUID(),
        nota: "Cumpleaños",
        // Campos que un cliente malicioso intentaría imponer
        total: 1,
        negocioId: b.negocio.id,
        items: [
          { varianteId: a.v.ceviche, cantidad: 2, notas: ["Sin cebolla"], precioUnitario: 0.5, nombreProducto: "Gratis" },
          { varianteId: a.v.pota18, cantidad: 1, notas: [] },
          { varianteId: a.v.gaseosa, cantidad: 3, notas: [] },
        ],
      });

    expect(res.status).toBe(201);
    const { pedido } = res.body;
    expect(pedido).toMatchObject({
      numero: 1,
      tipo: "MESA",
      estado: "PENDIENTE",
      mesa: { id: a.mesas[0].id, nombre: "Mesa 1" },
      mozo: { nombre: "mozo" },
      nota: "Cumpleaños",
      subtotal: "67.00", // 2×20 + 18 + 3×3
      costoEnvio: "0.00",
      cargoTapers: "0.00",
      descuento: "0.00",
      total: "67.00",
      pagado: false,
    });

    const porNombre = Object.fromEntries(pedido.items.map((i: { nombreProducto: string }) => [i.nombreProducto, i]));
    expect(Object.keys(porNombre)).toEqual(["Ceviche Simple", "Chicharrón de Pota — S/ 18", "Gaseosa Personal"]);
    expect(porNombre["Ceviche Simple"]).toMatchObject({
      cantidad: 2,
      precioUnitario: "20.00",
      notas: ["Sin cebolla"],
      areaId: a.areas.cocina.id,
      estado: "PENDIENTE",
    });
    expect(porNombre["Gaseosa Personal"].areaId).toBe(a.areas.bebidas.id);

    const enBase = await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(enBase.negocioId).toBe(a.negocio.id);
  });

  it("es idempotente por idCliente: reintentar devuelve el mismo pedido", async () => {
    const idCliente = randomUUID();
    const cuerpo = { mesaId: a.mesas[0].id, idCliente, items: [{ varianteId: a.v.ceviche }] };

    const primero = await crearPedido(mozo, cuerpo);
    const reintento = await crearPedido(mozo, cuerpo);
    const [c1, c2] = await Promise.all([
      crearPedido(mozo, { idCliente: "5b1b3f0e-8f0a-4c56-9d0e-0d5f0a1b2c3d", items: [{ varianteId: a.v.leche }] }),
      crearPedido(mozo, { idCliente: "5b1b3f0e-8f0a-4c56-9d0e-0d5f0a1b2c3d", items: [{ varianteId: a.v.leche }] }),
    ]);

    expect(primero.status).toBe(201);
    expect(reintento.status).toBe(200);
    expect(reintento.body.pedido).toEqual(primero.body.pedido);
    expect([c1.status, c2.status].sort()).toEqual([200, 201]);
    expect(c1.body.pedido.id).toBe(c2.body.pedido.id);
    expect(await prisma.pedido.count()).toBe(2);
    expect(await prisma.pedidoItem.count()).toBe(2);
  });

  it("no revela un pedido de otro negocio aunque se repita su idCliente", async () => {
    const idCliente = randomUUID();
    await crearPedido(mozo, { idCliente, items: [{ varianteId: a.v.ceviche }] });

    const res = await crearPedido(mozoB, { idCliente, items: [{ varianteId: b.v.ceviche }] });

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("ID_CLIENTE_EN_USO");
    expect(res.body.pedido).toBeUndefined();
  });

  it("acepta un combo válido (con repetición) y guarda los nombres elegidos", async () => {
    const { ceviche, leche } = a.productos;

    const mixto = await crearPedido(mozo, { items: [{ varianteId: a.v.combo, componentes: [leche.id, ceviche.id] }] });
    const repetido = await crearPedido(mozo, { items: [{ varianteId: a.v.combo, componentes: [ceviche.id, ceviche.id] }] });

    expect(mixto.status).toBe(201);
    expect(mixto.body.pedido.items[0]).toMatchObject({
      nombreProducto: "Combo Doble",
      precioUnitario: "25.00",
      componentes: ["Leche de Tigre", "Ceviche Simple"],
    });
    expect(repetido.body.pedido.items[0].componentes).toEqual(["Ceviche Simple", "Ceviche Simple"]);
  });

  it("rechaza combos inválidos con 400 y no crea nada", async () => {
    const { ceviche, leche, arroz } = a.productos;
    const combo = (componentes?: string[]) => crearPedido(mozo, { items: [{ varianteId: a.v.combo, componentes }] });

    const sinComponentes = await combo();
    const deMenos = await combo([ceviche.id]);
    const deMas = await combo([ceviche.id, leche.id, ceviche.id]);
    const fueraDeOpciones = await combo([ceviche.id, arroz.id]);
    const deOtroNegocio = await combo([ceviche.id, b.productos.ceviche.id]);
    const noEsCombo = await crearPedido(mozo, { items: [{ varianteId: a.v.ceviche, componentes: [leche.id] }] });

    for (const res of [sinComponentes, deMenos, deMas, fueraDeOpciones, deOtroNegocio, noEsCombo]) {
      expect(res.status).toBe(400);
    }
    expect(deMenos.body.error.mensaje).toBe('"Combo Doble" requiere elegir exactamente 2 platos');
    expect(fueraDeOpciones.body.error.mensaje).toContain("no es una de sus opciones");
    expect(await prisma.pedido.count()).toBe(0);
  });

  it("rechaza con 409 si la mesa ya tiene un pedido abierto, e indica su id", async () => {
    const abierto = await crearPedido(mozo, { mesaId: a.mesas[2].id, items: [{ varianteId: a.v.ceviche }] });

    const res = await crearPedido(cocina, { mesaId: a.mesas[2].id, items: [{ varianteId: a.v.leche }] });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ codigo: "MESA_OCUPADA", pedidoId: abierto.body.pedido.id });
    expect(res.body.error.mensaje).toContain("Mesa 3");

    // Al pagarse el pedido la mesa vuelve a quedar libre
    await prisma.pedido.update({ where: { id: abierto.body.pedido.id }, data: { pagado: true } });
    const despues = await crearPedido(mozo, { mesaId: a.mesas[2].id, items: [{ varianteId: a.v.leche }] });
    expect(despues.status).toBe(201);
  });

  it("dos pedidos simultáneos para la misma mesa: solo uno entra", async () => {
    const intentos = await Promise.all(
      [1, 2, 3].map(() => crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.ceviche }] })),
    );

    expect(intentos.map((r) => r.status).sort()).toEqual([201, 409, 409]);
  });

  it("numera con un correlativo diario por negocio", async () => {
    const item = { items: [{ varianteId: a.v.ceviche }] };
    const p1 = await crearPedido(mozo, item);
    const p2 = await crearPedido(mozo, item);
    const deB = await crearPedido(mozoB, { items: [{ varianteId: b.v.ceviche }] });

    expect([p1.body.pedido.numero, p2.body.pedido.numero]).toEqual([1, 2]);
    expect(deB.body.pedido.numero).toBe(1); // cada negocio lleva su propia cuenta

    // Los pedidos de A pasan a "ayer": el correlativo de hoy vuelve a empezar
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.pedido.updateMany({ where: { negocioId: a.negocio.id }, data: { creadoEn: ayer } });

    const p3 = await crearPedido(mozo, item);
    const p4 = await crearPedido(mozo, item);
    expect([p3.body.pedido.numero, p4.body.pedido.numero]).toEqual([1, 2]);
  });

  it("no repite números aunque los pedidos lleguen a la vez", async () => {
    const respuestas = await Promise.all(
      Array.from({ length: 8 }, () => crearPedido(mozo, { items: [{ varianteId: a.v.ceviche }] })),
    );

    const numeros = respuestas.map((r) => r.body.pedido.numero).sort((x, y) => x - y);
    expect(numeros).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("valida la entrada con 400", async () => {
    const sinMesa = await crearPedido(mozo, { tipo: "MESA", items: [{ varianteId: a.v.ceviche }] });
    const sinItems = await crearPedido(mozo, { items: [] });
    const cantidadCero = await crearPedido(mozo, { items: [{ varianteId: a.v.ceviche, cantidad: 0 }] });
    const idInvalido = await crearPedido(mozo, { idCliente: "abc", items: [{ varianteId: a.v.ceviche }] });
    const inexistente = await crearPedido(mozo, { items: [{ varianteId: randomUUID() }] });

    for (const res of [sinMesa, sinItems, cantidadCero, idInvalido, inexistente]) expect(res.status).toBe(400);
    expect(sinMesa.body.error.detalles).toEqual([{ campo: "mesaId", mensaje: "Un pedido de mesa necesita mesaId" }]);
  });
});

describe("GET /api/mesas", () => {
  it("marca la mesa como ocupada con su pedido abierto y su total", async () => {
    const { body } = await crearPedido(mozo, { mesaId: a.mesas[1].id, items: [{ varianteId: a.v.ceviche, cantidad: 2 }] });
    // Un pedido cancelado o ya pagado no ocupa la mesa
    const pagado = await crearPedido(mozo, { mesaId: a.mesas[2].id, items: [{ varianteId: a.v.leche }] });
    await prisma.pedido.update({ where: { id: pagado.body.pedido.id }, data: { pagado: true } });

    const res = await request(app).get("/api/mesas").set(conToken(admin));

    expect(res.status).toBe(200);
    expect(res.body.mesas).toEqual([
      { id: a.mesas[0].id, nombre: "Mesa 1", estado: "libre", pedido: null },
      {
        id: a.mesas[1].id,
        nombre: "Mesa 2",
        estado: "ocupada",
        pedido: { id: body.pedido.id, numero: 1, estado: "PENDIENTE", total: "40.00", creadoEn: body.pedido.creadoEn },
      },
      { id: a.mesas[2].id, nombre: "Mesa 3", estado: "libre", pedido: null },
    ]);
  });
});

describe("rondas, estados y cancelaciones", () => {
  // Pedido de mesa con 2 items de cocina y 1 de bebidas
  async function pedidoMixto() {
    const res = await crearPedido(mozo, {
      mesaId: a.mesas[0].id,
      items: [{ varianteId: a.v.ceviche, cantidad: 2 }, { varianteId: a.v.pota10 }, { varianteId: a.v.gaseosa }],
    });
    const items = res.body.pedido.items as { id: string; areaId: string; nombreProducto: string }[];
    return {
      id: res.body.pedido.id as string,
      deCocina: items.filter((i) => i.areaId === a.areas.cocina.id),
      deBebidas: items.filter((i) => i.areaId === a.areas.bebidas.id),
    };
  }

  const estados = (pedido: { items: { nombreProducto: string; estado: string }[] }) =>
    Object.fromEntries(pedido.items.map((i) => [i.nombreProducto, i.estado]));

  it("POST /:id/items agrega una ronda y recalcula el total", async () => {
    const pedido = await pedidoMixto(); // 40 + 10 + 3 = 53

    const res = await request(app)
      .post(`/api/pedidos/${pedido.id}/items`)
      .set(conToken(mozo))
      .send({ idRonda: randomUUID(), items: [{ varianteId: a.v.pota18, cantidad: 2, notas: ["Ají aparte"] }] });

    expect(res.status).toBe(201);
    expect(res.body.pedido.items).toHaveLength(4);
    expect(res.body.pedido).toMatchObject({ subtotal: "89.00", total: "89.00", numero: 1 });
    expect(await prisma.pedido.count()).toBe(1);
  });

  it("una ronda es idempotente por idRonda: reintentar no duplica los items", async () => {
    const pedido = await pedidoMixto(); // 53
    const ronda = { idRonda: randomUUID(), items: [{ varianteId: a.v.leche, cantidad: 2 }] };
    const enviar = () => request(app).post(`/api/pedidos/${pedido.id}/items`).set(conToken(mozo)).send(ronda);

    const primero = await enviar();
    const reintento = await enviar();
    const [s1, s2] = await Promise.all([
      request(app).post(`/api/pedidos/${pedido.id}/items`).set(conToken(mozo)).send({ ...ronda, idRonda: "7d0c2a0e-93c5-4f0b-a4f5-6a1d1b2c3d4e" }),
      request(app).post(`/api/pedidos/${pedido.id}/items`).set(conToken(cocina)).send({ ...ronda, idRonda: "7d0c2a0e-93c5-4f0b-a4f5-6a1d1b2c3d4e" }),
    ]);

    expect([primero.status, reintento.status]).toEqual([201, 200]);
    expect(reintento.body.pedido).toEqual(primero.body.pedido);
    expect([s1.status, s2.status].sort()).toEqual([200, 201]);
    // 3 items iniciales + 2 rondas de 1 item; 53 + 24 + 24
    expect(await prisma.pedidoItem.count({ where: { pedidoId: pedido.id } })).toBe(5);
    expect(s1.body.pedido.total === "101.00" || s2.body.pedido.total === "101.00").toBe(true);

    // La primera ronda lleva el idCliente del pedido; sin idRonda no se acepta
    const items = await prisma.pedidoItem.findMany({ where: { pedidoId: pedido.id }, orderBy: { orden: "asc" } });
    const { idCliente } = await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id } });
    expect(items.slice(0, 3).every((i) => i.idRonda === idCliente)).toBe(true);
    expect(items[3].idRonda).toBe(ronda.idRonda);
    const sinIdRonda = await request(app).post(`/api/pedidos/${pedido.id}/items`).set(conToken(mozo)).send({ items: ronda.items });
    expect(sinIdRonda.status).toBe(400);
  });

  it("los items conservan el orden en que se pidieron, ronda tras ronda", async () => {
    // Orden deliberadamente distinto al de la carta y al alfabético
    const creado = await crearPedido(mozo, {
      mesaId: a.mesas[0].id,
      items: [
        { varianteId: a.v.gaseosa },
        { varianteId: a.v.pota18 },
        { varianteId: a.v.ceviche },
        { varianteId: a.v.leche },
        { varianteId: a.v.gaseosa, notas: ["Bien helado"] },
      ],
    });
    const ronda = await request(app)
      .post(`/api/pedidos/${creado.body.pedido.id}/items`)
      .set(conToken(mozo))
      .send({ idRonda: randomUUID(), items: [{ varianteId: a.v.pota10, cantidad: 1 }, { varianteId: a.v.ceviche, cantidad: 1 }] });

    const nombres = (pedido: { items: { nombreProducto: string }[] }) => pedido.items.map((i) => i.nombreProducto);
    const primeraRonda = ["Gaseosa Personal", "Chicharrón de Pota — S/ 18", "Ceviche Simple", "Leche de Tigre", "Gaseosa Personal"];
    expect(nombres(creado.body.pedido)).toEqual(primeraRonda);
    expect(nombres(ronda.body.pedido)).toEqual([...primeraRonda, "Chicharrón de Pota — S/ 10", "Ceviche Simple"]);
    expect(ronda.body.pedido.items.map((i: { orden: number }) => i.orden)).toEqual([1, 2, 3, 4, 5, 6, 7]);

    const activos = await request(app).get("/api/pedidos/activos").set(conToken(cocina));
    expect(nombres(activos.body.pedidos[0])).toEqual(nombres(ronda.body.pedido));
  });

  it("POST /:id/items rechaza pedidos pagados", async () => {
    const pedido = await pedidoMixto();
    await prisma.pedido.update({ where: { id: pedido.id }, data: { pagado: true } });

    const res = await request(app)
      .post(`/api/pedidos/${pedido.id}/items`)
      .set(conToken(mozo))
      .send({ idRonda: randomUUID(), items: [{ varianteId: a.v.leche, cantidad: 1 }] });

    expect(res.status).toBe(409);
    expect(res.body.error.codigo).toBe("PEDIDO_PAGADO");
  });

  it("cambia el estado de un área entera y recalcula el estado del pedido", async () => {
    const pedido = await pedidoMixto();

    const preparando = await cambiarEstado(cocina, pedido.id, { areaId: a.areas.cocina.id, estado: "PREPARANDO" });
    expect(preparando.status).toBe(200);
    expect(estados(preparando.body.pedido)).toEqual({
      "Ceviche Simple": "PREPARANDO",
      "Chicharrón de Pota — S/ 10": "PREPARANDO",
      "Gaseosa Personal": "PENDIENTE",
    });
    expect(preparando.body.pedido.estado).toBe("PREPARANDO");

    // La cocina terminó, pero falta la bebida: el pedido aún no está LISTO
    const cocinaLista = await cambiarEstado(cocina, pedido.id, { areaId: a.areas.cocina.id, estado: "LISTO" });
    expect(estados(cocinaLista.body.pedido)["Gaseosa Personal"]).toBe("PENDIENTE");
    expect(cocinaLista.body.pedido.estado).toBe("PREPARANDO");

    const todoListo = await cambiarEstado(cocina, pedido.id, { areaId: a.areas.bebidas.id, estado: "LISTO" });
    expect(todoListo.body.pedido.estado).toBe("LISTO");

    const ids = [...pedido.deCocina, ...pedido.deBebidas].map((i) => i.id);
    const entregado = await cambiarEstado(mozo, pedido.id, { itemIds: ids, estado: "ENTREGADO" });
    expect(entregado.body.pedido.estado).toBe("ENTREGADO");
  });

  it("los items cancelados no cuentan para el estado del pedido", async () => {
    const pedido = await pedidoMixto();
    await cancelar(mozo, pedido.id, pedido.deBebidas[0].id);

    const res = await cambiarEstado(cocina, pedido.id, { areaId: a.areas.cocina.id, estado: "LISTO" });

    expect(res.body.pedido.estado).toBe("LISTO");
    expect(estados(res.body.pedido)["Gaseosa Personal"]).toBe("CANCELADO");
  });

  it("valida el cambio de estado", async () => {
    const pedido = await pedidoMixto();
    const idCocina = pedido.deCocina[0].id;

    const ambos = await cambiarEstado(cocina, pedido.id, { areaId: a.areas.cocina.id, itemIds: [idCocina], estado: "LISTO" });
    const ninguno = await cambiarEstado(cocina, pedido.id, { estado: "LISTO" });
    const cancelado = await cambiarEstado(cocina, pedido.id, { itemIds: [idCocina], estado: "CANCELADO" });
    const itemAjeno = await cambiarEstado(cocina, pedido.id, { itemIds: [idCocina, randomUUID()], estado: "LISTO" });

    expect([ambos.status, ninguno.status, cancelado.status]).toEqual([400, 400, 400]);
    expect(itemAjeno.status).toBe(404);
    const item = await prisma.pedidoItem.findUniqueOrThrow({ where: { id: idCocina } });
    expect(item.estado).toBe("PENDIENTE");
  });

  it("cancelar un item PENDIENTE recalcula los totales", async () => {
    const pedido = await pedidoMixto(); // 53
    const ceviche = pedido.deCocina.find((i) => i.nombreProducto === "Ceviche Simple")!;

    const res = await cancelar(mozo, pedido.id, ceviche.id);

    expect(res.status).toBe(200);
    expect(res.body.pedido).toMatchObject({ subtotal: "13.00", total: "13.00", estado: "PENDIENTE" });
    expect(estados(res.body.pedido)["Ceviche Simple"]).toBe("CANCELADO");

    const otraVez = await cancelar(mozo, pedido.id, ceviche.id);
    expect(otraVez.status).toBe(409);
  });

  it("solo ADMIN cancela un item que ya no está PENDIENTE", async () => {
    const pedido = await pedidoMixto();
    const [item] = pedido.deCocina;
    await cambiarEstado(cocina, pedido.id, { itemIds: [item.id], estado: "PREPARANDO" });

    const porMozo = await cancelar(mozo, pedido.id, item.id);
    const porCocina = await cancelar(cocina, pedido.id, item.id);
    const porAdmin = await cancelar(admin, pedido.id, item.id);

    expect([porMozo.status, porCocina.status]).toEqual([403, 403]);
    expect(porAdmin.status).toBe(200);
    expect(porAdmin.body.pedido.items.find((i: { id: string }) => i.id === item.id).estado).toBe("CANCELADO");
  });

  it("si se cancelan todos los items, el pedido queda CANCELADO y libera la mesa", async () => {
    const pedido = await pedidoMixto();
    let ultimo;
    for (const item of [...pedido.deCocina, ...pedido.deBebidas]) ultimo = await cancelar(mozo, pedido.id, item.id);

    expect(ultimo!.body.pedido).toMatchObject({ estado: "CANCELADO", total: "0.00" });
    const mesas = await request(app).get("/api/mesas").set(conToken(mozo));
    expect(mesas.body.mesas[0].estado).toBe("libre");
  });

  it("GET /activos lista por antigüedad, sin pagados-entregados ni cancelados, y filtra por área", async () => {
    const mixto = await pedidoMixto();
    const soloBebida = await crearPedido(mozo, { items: [{ varianteId: a.v.gaseosa }] });
    const soloCocina = await crearPedido(mozo, { items: [{ varianteId: a.v.leche }] });
    const cerrado = await crearPedido(mozo, { items: [{ varianteId: a.v.leche }] });
    const idCerrado = cerrado.body.pedido.id;
    await cambiarEstado(mozo, idCerrado, { itemIds: [cerrado.body.pedido.items[0].id], estado: "ENTREGADO" });
    await prisma.pedido.update({ where: { id: idCerrado }, data: { pagado: true } });
    // Fuerza un orden de antigüedad distinto al de creación
    await prisma.pedido.update({ where: { id: soloCocina.body.pedido.id }, data: { creadoEn: new Date(Date.now() - 60_000) } });

    const todos = await request(app).get("/api/pedidos/activos").set(conToken(cocina));
    const deBebidas = await request(app).get(`/api/pedidos/activos?areaId=${a.areas.bebidas.id}`).set(conToken(cocina));

    expect(todos.status).toBe(200);
    expect(todos.body.pedidos.map((p: { id: string }) => p.id)).toEqual([
      soloCocina.body.pedido.id,
      mixto.id,
      soloBebida.body.pedido.id,
    ]);
    expect(todos.body.pedidos[1].items).toHaveLength(3);

    expect(deBebidas.body.pedidos.map((p: { id: string }) => p.id)).toEqual([mixto.id, soloBebida.body.pedido.id]);
    expect(deBebidas.body.pedidos[0].items.map((i: { nombreProducto: string }) => i.nombreProducto)).toEqual(["Gaseosa Personal"]);
  });
});

describe("aislamiento entre negocios", () => {
  it("un usuario de otro negocio no ve ni puede tocar los pedidos", async () => {
    const { body } = await crearPedido(mozo, {
      mesaId: a.mesas[0].id,
      items: [{ varianteId: a.v.ceviche }, { varianteId: a.v.gaseosa }],
    });
    const pedidoA = body.pedido;
    const adminB = await tokenDe(b, "admin");

    // No los ve
    const activos = await request(app).get("/api/pedidos/activos").set(conToken(mozoB));
    const porArea = await request(app).get(`/api/pedidos/activos?areaId=${a.areas.cocina.id}`).set(conToken(mozoB));
    const mesas = await request(app).get("/api/mesas").set(conToken(mozoB));
    const carta = await request(app).get("/api/carta").set(conToken(mozoB));

    expect(activos.body.pedidos).toEqual([]);
    expect(porArea.body.pedidos).toEqual([]);
    expect(mesas.body.mesas.map((m: { id: string }) => m.id)).toEqual(b.mesas.map((m) => m.id));
    expect(mesas.body.mesas.every((m: { estado: string }) => m.estado === "libre")).toBe(true);
    expect(JSON.stringify(carta.body)).not.toContain(a.v.ceviche);

    // No los puede tocar: para B ese pedido no existe
    const agregar = await request(app)
      .post(`/api/pedidos/${pedidoA.id}/items`)
      .set(conToken(mozoB))
      .send({ idRonda: randomUUID(), items: [{ varianteId: b.v.ceviche, cantidad: 1 }] });
    const porItems = await cambiarEstado(mozoB, pedidoA.id, { itemIds: [pedidoA.items[0].id], estado: "LISTO" });
    const porAreaPatch = await cambiarEstado(mozoB, pedidoA.id, { areaId: a.areas.cocina.id, estado: "LISTO" });
    const cancelarItem = await cancelar(adminB, pedidoA.id, pedidoA.items[0].id);

    for (const res of [agregar, porItems, porAreaPatch, cancelarItem]) {
      expect(res.status).toBe(404);
      expect(res.body.error.mensaje).toBe("El pedido no existe");
    }

    // Tampoco puede usar la carta ni las mesas de A en sus propios pedidos
    const varianteAjena = await crearPedido(mozoB, { items: [{ varianteId: a.v.ceviche }] });
    const mesaAjena = await crearPedido(mozoB, { mesaId: a.mesas[1].id, items: [{ varianteId: b.v.ceviche }] });
    const propioDeB = await crearPedido(mozoB, { items: [{ varianteId: b.v.ceviche }] });
    const varianteAjenaEnRonda = await request(app)
      .post(`/api/pedidos/${propioDeB.body.pedido.id}/items`)
      .set(conToken(mozoB))
      .send({ idRonda: randomUUID(), items: [{ varianteId: a.v.ceviche, cantidad: 1 }] });

    expect(varianteAjena.status).toBe(400);
    expect(mesaAjena.status).toBe(404);
    expect(varianteAjenaEnRonda.status).toBe(400);

    // El pedido de A sigue intacto
    const despues = await request(app).get("/api/pedidos/activos").set(conToken(mozo));
    expect(despues.body.pedidos).toEqual([pedidoA]);
  });
});
