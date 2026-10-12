// Lo que no pasa por cocina (bebidas que saca el mozo) y la cancelación de
// unidades sueltas desde la cuenta de la mesa.
import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app, conToken, crearNegocio, crearPedido, limpiarBase, prisma, tokenDe, type NegocioDePrueba } from "./helpers";

let a: NegocioDePrueba;
let mozo: string;
let cocina: string;
let admin: string;

type Item = {
  id: string;
  nombreProducto: string;
  cantidad: number;
  estado: string;
  pasaPorCocina: boolean;
  listoEn: string | null;
  entregadoEn: string | null;
  idRonda: string;
  orden: number;
};

beforeEach(async () => {
  await limpiarBase();
  a = await crearNegocio("Negocio A", "negocio-a");
  // En este negocio las bebidas las saca el mozo de la refrigeradora
  await prisma.area.update({ where: { id: a.areas.bebidas.id }, data: { pasaPorCocina: false } });
  [mozo, cocina, admin] = await Promise.all([tokenDe(a, "mozo"), tokenDe(a, "cocina"), tokenDe(a, "admin")]);
});

afterAll(() => prisma.$disconnect());

const patch = (token: string, ruta: string, cuerpo?: object) =>
  request(app).patch(`/api/pedidos/${ruta}`).set(conToken(token)).send(cuerpo);

const cancelar = (token: string, pedidoId: string, itemId: string, cantidad?: number) =>
  patch(token, `${pedidoId}/items/${itemId}/cancelar`, cantidad === undefined ? undefined : { cantidad });

const ronda = (token: string, pedidoId: string, items: object[]) =>
  request(app).post(`/api/pedidos/${pedidoId}/items`).set(conToken(token)).send({ idRonda: randomUUID(), items: items.map((i) => ({ cantidad: 1, ...i })) });

const delivery = { tipo: "DELIVERY", cliente: { telefono: "987654321", direccion: "Jr. Lima 123" } };

const de = (items: Item[], nombre: string) => items.filter((i) => i.nombreProducto === nombre);

describe("áreas que no pasan por cocina", () => {
  it("GET /carta dice qué áreas pasan por cocina", async () => {
    const res = await request(app).get("/api/carta").set(conToken(mozo));
    expect(res.body.areas).toEqual([
      { id: a.areas.cocina.id, nombre: "Cocina", pasaPorCocina: true },
      { id: a.areas.bebidas.id, nombre: "Bebidas", pasaPorCocina: false },
    ]);
  });

  it("en MESA las bebidas nacen ENTREGADO, con su hora, y el pedido solo espera a la cocina", async () => {
    const res = await crearPedido(mozo, {
      mesaId: a.mesas[0].id,
      items: [{ varianteId: a.v.gaseosa, cantidad: 6 }, { varianteId: a.v.ceviche }],
    });
    expect(res.status).toBe(201);
    const [gaseosa] = de(res.body.pedido.items, "Gaseosa Personal");
    const [ceviche] = de(res.body.pedido.items, "Ceviche Simple");

    expect(gaseosa).toMatchObject({ estado: "ENTREGADO", pasaPorCocina: false, cantidad: 6 });
    expect(gaseosa.listoEn).not.toBeNull();
    expect(gaseosa.entregadoEn).not.toBeNull();
    expect(ceviche).toMatchObject({ estado: "PENDIENTE", pasaPorCocina: true, listoEn: null, entregadoEn: null });
    // Las bebidas ya en la mesa no convierten el pedido en "a medias"
    expect(res.body.pedido.estado).toBe("PENDIENTE");
    expect(res.body.pedido.total).toBe("38.00");

    // La cocina avanza su plato y el estado del pedido la sigue a ella
    const preparando = await patch(cocina, `${res.body.pedido.id}/items/estado`, { itemIds: [ceviche.id], estado: "PREPARANDO" });
    expect(preparando.body.pedido.estado).toBe("PREPARANDO");
    const listo = await patch(cocina, `${res.body.pedido.id}/items/estado`, { itemIds: [ceviche.id], estado: "LISTO" });
    expect(listo.body.pedido.estado).toBe("LISTO");
    const entregado = await patch(mozo, `${res.body.pedido.id}/items/estado`, { itemIds: [ceviche.id], estado: "ENTREGADO" });
    expect(entregado.body.pedido.estado).toBe("ENTREGADO");
    expect(de(entregado.body.pedido.items, "Ceviche Simple")[0].entregadoEn).not.toBeNull();
  });

  it("un pedido de mesa con solo bebidas no queda pendiente en cocina: nace ENTREGADO y sigue ocupando la mesa", async () => {
    const res = await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.gaseosa, cantidad: 2 }] });
    expect(res.body.pedido.estado).toBe("ENTREGADO");
    expect(res.body.pedido.items.every((i: Item) => i.estado === "ENTREGADO")).toBe(true);

    // Sigue activo (no está pagado) y la mesa sigue ocupada
    const activos = await request(app).get("/api/pedidos/activos").set(conToken(cocina));
    expect(activos.body.pedidos.map((p: { id: string }) => p.id)).toEqual([res.body.pedido.id]);
    const mesas = await request(app).get("/api/mesas").set(conToken(mozo));
    expect(mesas.body.mesas[0]).toMatchObject({ estado: "ocupada", pedido: { estado: "ENTREGADO", total: "6.00" } });
  });

  it("una ronda de solo bebidas entra directo y no devuelve el pedido a la cocina", async () => {
    const { body } = await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.ceviche }] });
    const id = body.pedido.id;
    await patch(cocina, `${id}/items/estado`, { areaId: a.areas.cocina.id, estado: "LISTO" });

    const conBebidas = await ronda(mozo, id, [{ varianteId: a.v.gaseosa, cantidad: 2 }]);
    expect(conBebidas.status).toBe(201);
    expect(de(conBebidas.body.pedido.items, "Gaseosa Personal")[0]).toMatchObject({ estado: "ENTREGADO", pasaPorCocina: false });
    expect(conBebidas.body.pedido.estado).toBe("LISTO");

    // Una ronda con un plato sí vuelve a la cocina
    const conPlato = await ronda(mozo, id, [{ varianteId: a.v.leche }]);
    expect(conPlato.body.pedido.estado).toBe("PREPARANDO");
  });

  it("en PARA_LLEVAR y DELIVERY las bebidas nacen LISTO: falta meterlas en la bolsa", async () => {
    for (const extra of [{}, delivery]) {
      const res = await crearPedido(mozo, { ...extra, items: [{ varianteId: a.v.gaseosa }, { varianteId: a.v.ceviche }] });
      expect(res.status).toBe(201);
      const [gaseosa] = de(res.body.pedido.items, "Gaseosa Personal");
      expect(gaseosa).toMatchObject({ estado: "LISTO", pasaPorCocina: false, entregadoEn: null });
      expect(gaseosa.listoEn).not.toBeNull();
      expect(res.body.pedido.estado).toBe("PENDIENTE");

      // Con el plato listo, el pedido está listo para salir; al entregarlo, todo queda entregado
      const id = res.body.pedido.id;
      const listo = await patch(cocina, `${id}/items/estado`, { areaId: a.areas.cocina.id, estado: "LISTO" });
      expect(listo.body.pedido.estado).toBe("LISTO");
      const entregado = await patch(cocina, `${id}/estado`, { estado: "ENTREGADO" });
      expect(entregado.body.pedido.estado).toBe("ENTREGADO");
      expect(entregado.body.pedido.items.every((i: Item) => i.estado === "ENTREGADO" && i.entregadoEn !== null)).toBe(true);
    }
  });

  it("un delivery de solo bebidas nace LISTO para salir", async () => {
    const res = await crearPedido(cocina, { ...delivery, items: [{ varianteId: a.v.gaseosa, cantidad: 3 }] });
    expect(res.body.pedido.estado).toBe("LISTO");
    const enCamino = await patch(cocina, `${res.body.pedido.id}/estado`, { estado: "EN_CAMINO" });
    expect(enCamino.body.pedido.estado).toBe("EN_CAMINO");
  });

  it("para llevar: si solo se entrega el plato, el pedido sigue LISTO hasta entregar también la bebida", async () => {
    const { body } = await crearPedido(mozo, { items: [{ varianteId: a.v.gaseosa }, { varianteId: a.v.ceviche }] });
    const [ceviche] = de(body.pedido.items, "Ceviche Simple");
    await patch(cocina, `${body.pedido.id}/items/estado`, { itemIds: [ceviche.id], estado: "LISTO" });
    const soloPlato = await patch(mozo, `${body.pedido.id}/items/estado`, { itemIds: [ceviche.id], estado: "ENTREGADO" });
    expect(soloPlato.body.pedido.estado).toBe("LISTO");
  });

  it("deshacer la entrega de una mesa no devuelve las bebidas: solo los platos vuelven a LISTO", async () => {
    const { body } = await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.gaseosa }, { varianteId: a.v.ceviche }] });
    const id = body.pedido.id;
    await patch(cocina, `${id}/items/estado`, { areaId: a.areas.cocina.id, estado: "LISTO" });
    await patch(cocina, `${id}/estado`, { estado: "ENTREGADO" });

    const deshecho = await patch(cocina, `${id}/estado`, { estado: "LISTO" });
    expect(deshecho.status).toBe(200);
    expect(de(deshecho.body.pedido.items, "Ceviche Simple")[0]).toMatchObject({ estado: "LISTO", entregadoEn: null });
    expect(de(deshecho.body.pedido.items, "Gaseosa Personal")[0].estado).toBe("ENTREGADO");
  });

  it("el panel de cocina puede dejar fuera las bebidas: cada item dice si pasa por cocina", async () => {
    await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.gaseosa, cantidad: 6 }, { varianteId: a.v.ceviche }] });
    await crearPedido(mozo, { mesaId: a.mesas[1].id, items: [{ varianteId: a.v.gaseosa }] });

    const activos = await request(app).get("/api/pedidos/activos").set(conToken(cocina));
    const porPreparar = activos.body.pedidos.flatMap((p: { items: Item[] }) =>
      p.items.filter((i) => i.pasaPorCocina && (i.estado === "PENDIENTE" || i.estado === "PREPARANDO")),
    );
    expect(porPreparar.map((i: Item) => i.nombreProducto)).toEqual(["Ceviche Simple"]);
    // Nada de lo que no pasa por cocina queda por preparar
    const sinCocina = activos.body.pedidos.flatMap((p: { items: Item[] }) => p.items.filter((i) => !i.pasaPorCocina));
    expect(sinCocina.map((i: Item) => i.estado)).toEqual(["ENTREGADO", "ENTREGADO"]);
  });

  it("cada item guarda su copia: cambiar el área después no toca los pedidos ya tomados", async () => {
    const { body } = await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.gaseosa }] });
    const cambio = await request(app).patch(`/api/admin/areas/${a.areas.bebidas.id}`).set(conToken(admin)).send({ pasaPorCocina: true });
    expect(cambio.status).toBe(204);

    const despues = await ronda(mozo, body.pedido.id, [{ varianteId: a.v.gaseosa }]);
    expect(despues.body.pedido.items.map((i: Item) => [i.pasaPorCocina, i.estado])).toEqual([
      [false, "ENTREGADO"],
      [true, "PENDIENTE"],
    ]);
  });

  it("PATCH /admin/areas/:id es solo del dueño y solo de su negocio", async () => {
    const ruta = `/api/admin/areas/${a.areas.cocina.id}`;
    expect((await request(app).patch(ruta).set(conToken(mozo)).send({ pasaPorCocina: false })).status).toBe(403);
    expect((await request(app).patch(ruta).set(conToken(cocina)).send({ pasaPorCocina: false })).status).toBe(403);
    expect((await request(app).patch(ruta).set(conToken(admin)).send({})).status).toBe(400);

    const b = await crearNegocio("Negocio B", "negocio-b");
    expect((await request(app).patch(`/api/admin/areas/${b.areas.cocina.id}`).set(conToken(admin)).send({ pasaPorCocina: false })).status).toBe(404);

    const carta = await request(app).get("/api/admin/carta").set(conToken(admin));
    expect(carta.body.areas.map((x: { pasaPorCocina: boolean }) => x.pasaPorCocina)).toEqual([true, false]);
  });

  it("se cobran de inmediato: la caja no espera a que la cocina marque nada", async () => {
    await request(app).post("/api/caja/abrir").set(conToken(cocina)).send({ montoInicial: 0 });
    const { body } = await crearPedido(mozo, {
      mesaId: a.mesas[0].id,
      items: [{ varianteId: a.v.gaseosa, cantidad: 2 }, { varianteId: a.v.ceviche }],
    });
    const id = body.pedido.id;

    const cuenta = await request(app).get(`/api/pedidos/${id}/cuenta`).set(conToken(cocina));
    expect(cuenta.body.cuenta.items.map((i: { nombreProducto: string; subtotal: string }) => [i.nombreProducto, i.subtotal])).toEqual([
      ["Gaseosa Personal", "6.00"],
      ["Ceviche Simple", "20.00"],
    ]);

    // El ceviche sigue PENDIENTE y aun así se cobra todo
    const pago = await request(app).post(`/api/pedidos/${id}/pagos`).set(conToken(cocina)).send({ pagos: [{ metodo: "YAPE", monto: 26 }] });
    expect(pago.status).toBe(201);
    expect(pago.body.pedido).toMatchObject({ pagado: true, estado: "PENDIENTE", saldoPendiente: "0.00" });
    const mesas = await request(app).get("/api/mesas").set(conToken(mozo));
    expect(mesas.body.mesas[0].estado).toBe("libre");
  });

  it("el tiempo de cocina de los reportes no cuenta lo que no pasa por cocina", async () => {
    const { body } = await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.gaseosa, cantidad: 4 }, { varianteId: a.v.ceviche }] });
    await patch(cocina, `${body.pedido.id}/items/estado`, { areaId: a.areas.cocina.id, estado: "LISTO" });

    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
    const reporte = await request(app).get(`/api/admin/reportes?desde=${hoy}&hasta=${hoy}`).set(conToken(admin));
    expect(reporte.body.cocina.platos).toBe(1);
    expect(reporte.body.cocina.porArea).toEqual([expect.objectContaining({ area: "Cocina", platos: 1 })]);
  });
});

describe("cancelación parcial de un item", () => {
  let pedidoId: string;
  let gaseosa: Item;
  let ceviche: Item;

  beforeEach(async () => {
    const { body } = await crearPedido(mozo, {
      mesaId: a.mesas[0].id,
      items: [{ varianteId: a.v.gaseosa, cantidad: 6, notas: ["Bien helado"] }, { varianteId: a.v.ceviche, cantidad: 3 }],
    });
    pedidoId = body.pedido.id;
    [gaseosa] = de(body.pedido.items, "Gaseosa Personal");
    [ceviche] = de(body.pedido.items, "Ceviche Simple");
  });

  it("quita unidades sueltas: el item se divide y los totales bajan", async () => {
    const res = await cancelar(mozo, pedidoId, ceviche.id, 1);
    expect(res.status).toBe(200);

    const filas = de(res.body.pedido.items, "Ceviche Simple");
    expect(filas.map((i: Item) => [i.cantidad, i.estado])).toEqual(expect.arrayContaining([[2, "PENDIENTE"], [1, "CANCELADO"]]));
    // El item original conserva su id; lo cancelado queda en la misma ronda y posición
    const vivo = filas.find((i: Item) => i.estado === "PENDIENTE")!;
    const cancelado = filas.find((i: Item) => i.estado === "CANCELADO")!;
    expect(vivo.id).toBe(ceviche.id);
    expect(cancelado).toMatchObject({ idRonda: ceviche.idRonda, orden: ceviche.orden });
    // 6 gaseosas (18) + 2 ceviches (40)
    expect(res.body.pedido.total).toBe("58.00");

    const cuenta = await request(app).get(`/api/pedidos/${pedidoId}/cuenta`).set(conToken(cocina));
    expect(cuenta.body.cuenta.items.map((i: { cantidad: number }) => i.cantidad)).toEqual([6, 2]);
  });

  it("sin cantidad, o con todas las unidades, cancela el item entero sin dividirlo", async () => {
    const entero = await cancelar(mozo, pedidoId, ceviche.id);
    expect(de(entero.body.pedido.items, "Ceviche Simple").map((i: Item) => [i.cantidad, i.estado])).toEqual([[3, "CANCELADO"]]);

    const todas = await cancelar(mozo, pedidoId, gaseosa.id, 6);
    expect(de(todas.body.pedido.items, "Gaseosa Personal").map((i: Item) => [i.cantidad, i.estado])).toEqual([[6, "CANCELADO"]]);
    // No queda nada vivo: el pedido se cancela y libera la mesa
    expect(todas.body.pedido.estado).toBe("CANCELADO");
  });

  it("valida la cantidad", async () => {
    expect((await cancelar(mozo, pedidoId, ceviche.id, 4)).status).toBe(400);
    expect((await cancelar(mozo, pedidoId, ceviche.id, 0)).status).toBe(400);
    expect((await cancelar(mozo, pedidoId, ceviche.id, 1.5)).status).toBe(400);
    const sinCambios = await request(app).get("/api/pedidos/activos").set(conToken(mozo));
    expect(sinCambios.body.pedidos[0].total).toBe("78.00");
  });

  it("el mozo quita bebidas que no pasan por cocina aunque ya estén entregadas, y queda registrado quién y cuándo", async () => {
    expect(gaseosa.estado).toBe("ENTREGADO");
    const res = await cancelar(mozo, pedidoId, gaseosa.id, 1);
    expect(res.status).toBe(200);
    expect(de(res.body.pedido.items, "Gaseosa Personal").map((i: Item) => [i.cantidad, i.estado])).toEqual(
      expect.arrayContaining([[5, "ENTREGADO"], [1, "CANCELADO"]]),
    );
    expect(res.body.pedido.total).toBe("75.00");

    const usuarioMozo = await prisma.usuario.findFirstOrThrow({ where: { negocioId: a.negocio.id, usuario: "mozo" } });
    const fila = await prisma.pedidoItem.findFirstOrThrow({ where: { pedidoId, estado: "CANCELADO" } });
    expect(fila.canceladoPorId).toBe(usuarioMozo.id);
    expect(fila.canceladoEn).not.toBeNull();

    // Visible en la auditoría del dueño
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
    const reporte = await request(app).get(`/api/admin/reportes?desde=${hoy}&hasta=${hoy}`).set(conToken(admin));
    expect(reporte.body.cancelaciones).toEqual([
      expect.objectContaining({
        nombreProducto: "Gaseosa Personal",
        cantidad: 1,
        monto: "3.00",
        usuario: "mozo",
        pasaPorCocina: false,
        yaEntregado: true,
        pedido: expect.objectContaining({ id: pedidoId, mesa: "Mesa 1" }),
      }),
    ]);
  });

  it("lo que la cocina ya empezó no lo quita el mozo ni el local: solo el dueño, también por unidades", async () => {
    for (const estado of ["PREPARANDO", "LISTO"]) {
      await patch(cocina, `${pedidoId}/items/estado`, { itemIds: [ceviche.id], estado });
      expect((await cancelar(mozo, pedidoId, ceviche.id, 1)).status).toBe(403);
      expect((await cancelar(cocina, pedidoId, ceviche.id, 1)).status).toBe(403);
    }
    const delDueno = await cancelar(admin, pedidoId, ceviche.id, 1);
    expect(delDueno.status).toBe(200);
    expect(de(delDueno.body.pedido.items, "Ceviche Simple").map((i: Item) => [i.cantidad, i.estado])).toEqual(
      expect.arrayContaining([[2, "LISTO"], [1, "CANCELADO"]]),
    );
  });

  it("no cancela más unidades de las que siguen sin cobrar", async () => {
    await request(app).post("/api/caja/abrir").set(conToken(cocina)).send({ montoInicial: 0 });
    // Se cobran 4 de las 6 gaseosas en una cuenta dividida
    const pago = await request(app)
      .post(`/api/pedidos/${pedidoId}/pagos`)
      .set(conToken(cocina))
      .send({ pagos: [{ metodo: "EFECTIVO", monto: 12 }], items: [{ itemId: gaseosa.id, cantidad: 4 }] });
    expect(pago.status).toBe(201);

    const demasiadas = await cancelar(mozo, pedidoId, gaseosa.id, 3);
    expect(demasiadas.status).toBe(409);
    expect(demasiadas.body.error.codigo).toBe("ITEM_PAGADO");

    const lasQueQuedan = await cancelar(mozo, pedidoId, gaseosa.id, 2);
    expect(lasQueQuedan.status).toBe(200);
    // Las 4 cobradas siguen en el item original, pagadas
    const cuenta = await request(app).get(`/api/pedidos/${pedidoId}/cuenta`).set(conToken(cocina));
    expect(cuenta.body.cuenta.items[0]).toMatchObject({ id: gaseosa.id, cantidad: 4, cantidadPagada: 4, pagado: true });

    expect((await cancelar(mozo, pedidoId, gaseosa.id, 1)).body.error.codigo).toBe("ITEM_PAGADO");
  });

  it("no toca pedidos de otro negocio, pagados o cancelados", async () => {
    const b = await crearNegocio("Negocio B", "negocio-b");
    const mozoB = await tokenDe(b, "mozo");
    expect((await cancelar(mozoB, pedidoId, ceviche.id, 1)).status).toBe(404);

    await request(app).post("/api/caja/abrir").set(conToken(cocina)).send({ montoInicial: 0 });
    await request(app).post(`/api/pedidos/${pedidoId}/pagos`).set(conToken(cocina)).send({ pagos: [{ metodo: "YAPE", monto: 78 }] });
    const pagado = await cancelar(mozo, pedidoId, gaseosa.id, 1);
    expect(pagado.status).toBe(409);
    expect(pagado.body.error.codigo).toBe("PEDIDO_PAGADO");
  });

  it("los tapers de un para llevar se recalculan con las unidades que quedan", async () => {
    const { body } = await crearPedido(mozo, { items: [{ varianteId: a.v.ceviche, cantidad: 3 }] });
    expect(body.pedido.cantidadTapers).toBe(3);
    const res = await cancelar(mozo, body.pedido.id, body.pedido.items[0].id, 2);
    expect(res.body.pedido).toMatchObject({ cantidadTapers: 1, cargoTapers: "1.00", total: "21.00" });
  });
});
