import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { app, CLAVE, conToken, crearNegocio, crearPedido, limpiarBase, prisma, tokenDe, type NegocioDePrueba } from "./helpers";

let a: NegocioDePrueba;
let b: NegocioDePrueba;
let admin: string;
let mozo: string;
let caja: string;

beforeEach(async () => {
  await limpiarBase();
  a = await crearNegocio("Negocio A", "negocio-a");
  b = await crearNegocio("Negocio B", "negocio-b");
  [admin, mozo, caja] = await Promise.all([tokenDe(a, "admin"), tokenDe(a, "mozo"), tokenDe(a, "cocina")]);
});

afterAll(() => prisma.$disconnect());

type Metodo = "get" | "post" | "patch" | "put" | "delete";
const pedir = (token: string, metodo: Metodo, ruta: string, cuerpo?: object) => {
  const r = request(app)[metodo](`/api/admin${ruta}`).set(conToken(token));
  return cuerpo ? r.send(cuerpo) : r;
};
const dueno = (metodo: Metodo, ruta: string, cuerpo?: object) => pedir(admin, metodo, ruta, cuerpo);
const carta = async (token = mozo) => (await request(app).get("/api/carta").set(conToken(token))).body;
const cartaAdmin = async () => (await dueno("get", "/carta")).body;
const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());

const ID = "00000000-0000-4000-8000-000000000000";
// Una por cada ruta de /api/admin
const RUTAS: [Metodo, string][] = [
  ["get", "/carta"],
  ["post", "/categorias"],
  ["patch", `/categorias/${ID}`],
  ["delete", `/categorias/${ID}`],
  ["post", `/categorias/${ID}/mover`],
  ["post", "/productos"],
  ["patch", `/productos/${ID}`],
  ["delete", `/productos/${ID}`],
  ["post", `/productos/${ID}/mover`],
  ["patch", `/variantes/${ID}/precio`],
  ["get", "/usuarios"],
  ["post", "/usuarios"],
  ["patch", `/usuarios/${ID}`],
  ["put", `/usuarios/${ID}/password`],
  ["get", "/mesas"],
  ["post", "/mesas"],
  ["patch", `/mesas/${ID}`],
  ["delete", `/mesas/${ID}`],
  ["post", `/mesas/${ID}/mover`],
  ["get", "/repartidores"],
  ["post", "/repartidores"],
  ["patch", `/repartidores/${ID}`],
  ["delete", `/repartidores/${ID}`],
  ["get", "/notas"],
  ["post", "/notas"],
  ["patch", `/notas/${ID}`],
  ["delete", `/notas/${ID}`],
  ["post", `/notas/${ID}/mover`],
  ["get", "/negocio"],
  ["patch", "/negocio"],
  ["put", "/negocio/logo"],
  ["delete", "/negocio/logo"],
  ["get", "/reportes"],
];

describe("permisos de /api/admin", () => {
  it("solo deja pasar al dueño: MOZO y LOCAL reciben 403 y sin sesión 401", async () => {
    for (const [metodo, ruta] of RUTAS) {
      const [delMozo, deCaja, sinSesion] = await Promise.all([
        pedir(mozo, metodo, ruta, {}),
        pedir(caja, metodo, ruta, {}),
        request(app)[metodo](`/api/admin${ruta}`),
      ]);
      expect([metodo, ruta, delMozo.status, delMozo.body.error?.codigo]).toEqual([metodo, ruta, 403, "SIN_PERMISO"]);
      expect([metodo, ruta, deCaja.status]).toEqual([metodo, ruta, 403]);
      expect([metodo, ruta, sinSesion.status]).toEqual([metodo, ruta, 401]);
    }
  });

  it("lo de otro negocio no existe: 404", async () => {
    const otro = b.productos.ceviche;
    const respuestas = await Promise.all([
      dueno("patch", `/productos/${otro.id}`, { nombre: "Mío" }),
      dueno("delete", `/productos/${otro.id}`),
      dueno("patch", `/variantes/${otro.variantes[0].id}/precio`, { precio: 1 }),
      dueno("patch", `/mesas/${b.mesas[0].id}`, { nombre: "Mía" }),
      dueno("patch", `/repartidores/${b.repartidor.id}`, { nombre: "Mío" }),
      dueno("patch", `/categorias/${otro.categoriaId}`, { nombre: "Mía" }),
    ]);
    expect(respuestas.map((r) => r.status)).toEqual([404, 404, 404, 404, 404, 404]);
    expect((await prisma.varianteProducto.findUniqueOrThrow({ where: { id: otro.variantes[0].id } })).precio.toFixed(2)).toBe("20.00");
  });
});

describe("carta", () => {
  it("GET /carta trae todo, también lo inactivo, y dice qué se puede eliminar", async () => {
    await prisma.producto.update({ where: { id: a.productos.arroz.id }, data: { activo: false } });
    await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.ceviche }] });

    const res = await dueno("get", "/carta");
    const productos = res.body.categorias[0].productos as { nombre: string; activo: boolean; eliminable: boolean }[];
    const de = (nombre: string) => productos.find((p) => p.nombre === nombre);

    expect(res.status).toBe(200);
    expect(res.body.areas.map((x: { nombre: string }) => x.nombre)).toEqual(["Cocina", "Bebidas"]);
    expect(res.body.categorias[0]).toMatchObject({ nombre: "Carta", activo: true, eliminable: false });
    expect(de("Arroz con Mariscos")).toMatchObject({ activo: false, eliminable: true });
    expect(de("Ceviche Simple")).toMatchObject({ activo: true, eliminable: false });
    expect(de("Combo Doble")).toMatchObject({ esCombo: true, comboCantidad: 2, opcionesCombo: [{ nombre: "Ceviche Simple" }, { nombre: "Leche de Tigre" }] });
    // El mozo no ve lo inactivo
    expect(JSON.stringify(await carta())).not.toContain("Arroz con Mariscos");
  });

  it("cambia un precio sin tocar los pedidos ya tomados", async () => {
    const antes = await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.ceviche, cantidad: 2 }] });

    const res = await dueno("patch", `/variantes/${a.v.ceviche}/precio`, { precio: 23.5 });
    const despues = await crearPedido(mozo, { mesaId: a.mesas[1].id, items: [{ varianteId: a.v.ceviche }] });
    const viejo = await request(app).get(`/api/pedidos/${antes.body.pedido.id}/cuenta`).set(conToken(mozo));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: a.v.ceviche, precio: "23.50" });
    expect(viejo.body.cuenta).toMatchObject({ total: "40.00", items: [{ precioUnitario: "20.00" }] });
    expect(despues.body.pedido).toMatchObject({ total: "23.50", items: [{ precioUnitario: "23.50" }] });
    expect(JSON.stringify(await carta())).toContain('"precio":"23.50"');
    expect((await dueno("patch", `/variantes/${a.v.ceviche}/precio`, { precio: -1 })).status).toBe(400);
    expect((await dueno("patch", `/variantes/${a.v.ceviche}/precio`, { precio: 1.234 })).status).toBe(400);
  });

  it("crea, renombra, desactiva, ordena y elimina categorías", async () => {
    const nueva = await dueno("post", "/categorias", { nombre: "  Postres " });
    const id = nueva.body.id as string;
    const nombres = async () => (await cartaAdmin()).categorias.map((c: { nombre: string }) => c.nombre);

    expect(nueva.status).toBe(201);
    expect(await nombres()).toEqual(["Carta", "Postres"]);

    expect((await dueno("post", `/categorias/${id}/mover`, { direccion: "subir" })).status).toBe(204);
    expect(await nombres()).toEqual(["Postres", "Carta"]);
    // Ya está arriba: no pasa nada
    expect((await dueno("post", `/categorias/${id}/mover`, { direccion: "subir" })).status).toBe(204);
    expect(await nombres()).toEqual(["Postres", "Carta"]);
    expect((await dueno("post", `/categorias/${id}/mover`, { direccion: "arriba" })).status).toBe(400);

    expect((await dueno("patch", `/categorias/${id}`, { nombre: "Dulces", activo: false })).status).toBe(204);
    expect((await cartaAdmin()).categorias[0]).toMatchObject({ nombre: "Dulces", activo: false, eliminable: true });
    expect((await dueno("patch", `/categorias/${id}`, {})).status).toBe(400);

    const conPlatos = await dueno("delete", `/categorias/${a.productos.ceviche.categoriaId}`);
    expect(conPlatos.status).toBe(409);
    expect(conPlatos.body.error.codigo).toBe("CON_HISTORIAL");
    expect((await dueno("delete", `/categorias/${id}`)).status).toBe(204);
    expect(await nombres()).toEqual(["Carta"]);
  });

  it("crea un plato de un precio, uno con variantes y un combo", async () => {
    const base = { categoriaId: a.productos.ceviche.categoriaId, areaId: a.areas.cocina.id, tapers: 1, esCombo: false, comboCantidad: null, opcionesCombo: [] };

    const simple = await dueno("post", "/productos", { ...base, nombre: "Jalea", variantes: [{ nombre: "lo que sea", precio: 28 }] });
    const variantes = await dueno("post", "/productos", { ...base, nombre: "Chaufa", variantes: [{ nombre: "Personal", precio: 15 }, { nombre: "Fuente", precio: 30 }] });
    const combo = await dueno("post", "/productos", {
      ...base, nombre: "Combo Triple", tapers: 3, esCombo: true, comboCantidad: 3, variantes: [{ precio: 35 }],
      opcionesCombo: [a.productos.ceviche.id, a.productos.leche.id, a.productos.arroz.id],
    });

    expect([simple.status, variantes.status, combo.status]).toEqual([201, 201, 201]);
    const productos = (await carta()).categorias[0].productos as { nombre: string; variantes: object[]; opcionesCombo: object[] }[];
    // Los nuevos van al final de su categoría
    expect(productos.slice(-3).map((p) => p.nombre)).toEqual(["Jalea", "Chaufa", "Combo Triple"]);
    expect(productos.at(-3)!.variantes).toMatchObject([{ nombre: "Única", precio: "28.00" }]);
    expect(productos.at(-2)!.variantes).toMatchObject([{ nombre: "Personal", precio: "15.00" }, { nombre: "Fuente", precio: "30.00" }]);
    expect(productos.at(-1)).toMatchObject({ esCombo: true, comboCantidad: 3 });
    expect(productos.at(-1)!.opcionesCombo).toHaveLength(3);
  });

  it("rechaza platos mal armados", async () => {
    const base = { nombre: "X", categoriaId: a.productos.ceviche.categoriaId, areaId: a.areas.cocina.id, tapers: 1, esCombo: false, comboCantidad: null, opcionesCombo: [], variantes: [{ precio: 10 }] };
    const malos = [
      { ...base, variantes: [] },
      { ...base, variantes: [{ nombre: "A", precio: 1 }, { nombre: "", precio: 2 }] },
      { ...base, variantes: [{ nombre: "A", precio: 1 }, { nombre: "a", precio: 2 }] },
      { ...base, esCombo: true, comboCantidad: 2 }, // sin platos para elegir
      { ...base, esCombo: true, comboCantidad: 2, opcionesCombo: [a.productos.combo.id] }, // un combo dentro de otro
      { ...base, esCombo: true, comboCantidad: 2, opcionesCombo: [b.productos.ceviche.id] }, // plato de otro negocio
      { ...base, categoriaId: b.productos.ceviche.categoriaId },
      { ...base, areaId: b.areas.cocina.id },
      { ...base, nombre: "" },
    ];
    for (const cuerpo of malos) expect((await dueno("post", "/productos", cuerpo)).status).toBe(400);
    expect(await prisma.producto.count({ where: { negocioId: a.negocio.id } })).toBe(6);
  });

  it("edita un plato: las variantes vendidas que se quitan se retiran sin borrarse", async () => {
    const pota = a.productos.pota;
    await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.pota10 }] });

    const res = await dueno("patch", `/productos/${pota.id}`, {
      nombre: "Chicharrón de Pota Especial",
      areaId: a.areas.bebidas.id,
      tapers: 2,
      // Se quitan las dos de antes (una vendida, otra no) y entra una nueva
      variantes: [{ nombre: "Grande", precio: 24 }],
    });
    const producto = (await cartaAdmin()).categorias[0].productos.find((p: { id: string }) => p.id === pota.id);
    const enBase = await prisma.varianteProducto.findMany({ where: { productoId: pota.id }, orderBy: { precio: "asc" } });

    expect(res.status).toBe(204);
    expect(producto).toMatchObject({ nombre: "Chicharrón de Pota Especial", areaId: a.areas.bebidas.id, tapers: 2, eliminable: false, variantes: [{ nombre: "Única", precio: "24.00" }] });
    // La vendida queda inactiva; la que nunca se vendió desaparece
    expect(enBase.map((v) => [v.id === a.v.pota10, v.activo])).toEqual([[true, false], [false, true]]);
    // Ya no se puede pedir con la variante retirada
    expect((await crearPedido(mozo, { mesaId: a.mesas[1].id, items: [{ varianteId: a.v.pota10 }] })).status).not.toBe(201);
    // Una variante de otro plato no se puede colar
    expect((await dueno("patch", `/productos/${pota.id}`, { variantes: [{ id: a.v.ceviche, nombre: "", precio: 1 }] })).status).toBe(400);
  });

  it("desactiva un plato y solo elimina los que nunca se vendieron", async () => {
    await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.ceviche }] });

    const vendido = await dueno("delete", `/productos/${a.productos.ceviche.id}`);
    const nuevo = await dueno("delete", `/productos/${a.productos.arroz.id}`);
    const apagado = await dueno("patch", `/productos/${a.productos.ceviche.id}`, { activo: false });

    expect(vendido.status).toBe(409);
    expect(vendido.body.error.codigo).toBe("CON_HISTORIAL");
    expect([nuevo.status, apagado.status]).toEqual([204, 204]);
    const texto = JSON.stringify(await carta());
    expect(texto).not.toContain("Arroz con Mariscos");
    expect(texto).not.toContain("Ceviche Simple");
    expect(await prisma.producto.count({ where: { id: a.productos.arroz.id } })).toBe(0);
  });

  it("mueve un plato dentro de su categoría", async () => {
    const nombres = async () => (await cartaAdmin()).categorias[0].productos.map((p: { nombre: string }) => p.nombre).slice(0, 3);

    expect((await dueno("post", `/productos/${a.productos.leche.id}/mover`, { direccion: "subir" })).status).toBe(204);
    expect(await nombres()).toEqual(["Leche de Tigre", "Ceviche Simple", "Arroz con Mariscos"]);
    expect((await dueno("post", `/productos/${a.productos.leche.id}/mover`, { direccion: "bajar" })).status).toBe(204);
    expect(await nombres()).toEqual(["Ceviche Simple", "Leche de Tigre", "Arroz con Mariscos"]);
  });
});

describe("personal", () => {
  const entrar = (usuario: string, password: string) => request(app).post("/api/auth/login").send({ codigoNegocio: "negocio-a", usuario, password });
  const idDe = async (usuario: string) => (await prisma.usuario.findFirstOrThrow({ where: { negocioId: a.negocio.id, usuario } })).id;

  it("lista al personal sin contraseñas", async () => {
    const res = await dueno("get", "/usuarios");

    expect(res.status).toBe(200);
    expect(res.body.usuarios.map((u: { usuario: string }) => u.usuario)).toEqual(["admin", "cocina", "mozo"]);
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("crea a alguien que ya puede entrar con su puesto", async () => {
    const res = await dueno("post", "/usuarios", { nombre: "Soger", usuario: " Soger ", password: "secreto1", roles: ["MOZO"] });
    const sesion = await entrar("soger", "secreto1");

    expect(res.status).toBe(201);
    expect(res.body.usuario).toMatchObject({ nombre: "Soger", usuario: "soger", roles: ["MOZO"], activo: true });
    expect(sesion.status).toBe(200);
    expect(sesion.body.usuario.roles).toEqual(["MOZO"]);
  });

  it("rechaza usuarios repetidos y datos incompletos", async () => {
    const repetido = await dueno("post", "/usuarios", { nombre: "Otro", usuario: "mozo", password: "secreto1", roles: ["MOZO"] });
    const malos = [
      { nombre: "X", usuario: "con espacio", password: "secreto1", roles: ["MOZO"] },
      { nombre: "X", usuario: "equis", password: "corta", roles: ["MOZO"] },
      { nombre: "X", usuario: "equis", password: "secreto1", roles: [] },
      { nombre: "", usuario: "equis", password: "secreto1", roles: ["MOZO"] },
    ];

    expect(repetido.status).toBe(409);
    expect(repetido.body.error.codigo).toBe("USUARIO_EN_USO");
    for (const cuerpo of malos) expect((await dueno("post", "/usuarios", cuerpo)).status).toBe(400);
    // El mismo usuario sí puede existir en otro negocio
    expect(await prisma.usuario.count({ where: { usuario: "mozo" } })).toBe(2);
    expect((await dueno("patch", `/usuarios/${await idDe("cocina")}`, { usuario: "mozo" })).status).toBe(409);
  });

  it("cambia puestos y desactiva: la sesión de esa persona deja de valer", async () => {
    const id = await idDe("mozo");

    const masPuestos = await dueno("patch", `/usuarios/${id}`, { nombre: "Soger", roles: ["MOZO", "LOCAL"] });
    expect(masPuestos.body.usuario).toMatchObject({ nombre: "Soger", roles: ["MOZO", "LOCAL"] });
    // Su token decía solo MOZO: tiene que volver a entrar
    expect((await carta(mozo)).error.codigo).toBe("NO_AUTENTICADO");

    expect((await dueno("patch", `/usuarios/${id}`, { activo: false })).status).toBe(200);
    expect((await entrar("mozo", CLAVE)).status).toBe(401);
    expect((await dueno("patch", `/usuarios/${id}`, { activo: true })).status).toBe(200);
    expect((await entrar("mozo", CLAVE)).status).toBe(200);
  });

  it("cambia la contraseña de alguien", async () => {
    const id = await idDe("mozo");

    expect((await dueno("put", `/usuarios/${id}/password`, { password: "12345" })).status).toBe(400);
    expect((await dueno("put", `/usuarios/${id}/password`, { password: "nueva123" })).status).toBe(204);
    expect((await entrar("mozo", CLAVE)).status).toBe(401);
    expect((await entrar("mozo", "nueva123")).status).toBe(200);
  });

  it("el dueño no puede quitarse su puesto ni desactivarse", async () => {
    const id = await idDe("admin");

    const sinPuesto = await dueno("patch", `/usuarios/${id}`, { roles: ["MOZO"] });
    const apagado = await dueno("patch", `/usuarios/${id}`, { activo: false });
    // Sumarse un puesto sí puede
    const conCocina = await dueno("patch", `/usuarios/${id}`, { roles: ["ADMIN", "LOCAL"] });

    expect([sinPuesto.status, apagado.status]).toEqual([409, 409]);
    expect(sinPuesto.body.error.codigo).toBe("ES_TU_USUARIO");
    expect(conCocina.status).toBe(200);
  });

  it("otro dueño sí puede quitarle el puesto a uno, mientras quede alguno", async () => {
    const nuevo = await dueno("post", "/usuarios", { nombre: "Socia", usuario: "socia", password: "secreto1", roles: ["ADMIN"] });
    const primero = await idDe("admin");
    const socia = (await entrar("socia", "secreto1")).body.token as string;

    expect((await pedir(socia, "patch", `/usuarios/${primero}`, { roles: ["LOCAL"] })).status).toBe(200);
    // El primero ya no es dueño
    expect((await dueno("get", "/usuarios")).status).toBe(401);
    expect((await pedir(socia, "patch", `/usuarios/${nuevo.body.usuario.id}`, { activo: false })).status).toBe(409);
  });
});

describe("mesas, motorizados y notas", () => {
  it("mesas: crea, renombra, ordena, desactiva y elimina solo las que no tienen historial", async () => {
    const nueva = await dueno("post", "/mesas", { nombre: "Terraza" });
    const id = nueva.body.id as string;
    const lista = async () => (await dueno("get", "/mesas")).body.mesas as { id: string; nombre: string; activo: boolean; eliminable: boolean }[];
    await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.ceviche }] });

    expect(nueva.status).toBe(201);
    expect((await lista()).map((m) => [m.nombre, m.eliminable])).toEqual([["Mesa 1", false], ["Mesa 2", true], ["Mesa 3", true], ["Terraza", true]]);

    await dueno("post", `/mesas/${id}/mover`, { direccion: "subir" });
    await dueno("patch", `/mesas/${id}`, { nombre: "Terraza 1" });
    expect((await lista()).map((m) => m.nombre)).toEqual(["Mesa 1", "Mesa 2", "Terraza 1", "Mesa 3"]);

    // Con un pedido abierto no se desactiva
    const ocupada = await dueno("patch", `/mesas/${a.mesas[0].id}`, { activo: false });
    expect(ocupada.status).toBe(409);
    expect(ocupada.body.error.codigo).toBe("MESA_OCUPADA");

    expect((await dueno("patch", `/mesas/${a.mesas[1].id}`, { activo: false })).status).toBe(204);
    const delMozo = (await request(app).get("/api/mesas").set(conToken(mozo))).body.mesas as { nombre: string }[];
    expect(delMozo.map((m) => m.nombre)).toEqual(["Mesa 1", "Terraza 1", "Mesa 3"]);

    expect((await dueno("delete", `/mesas/${a.mesas[0].id}`)).body.error.codigo).toBe("CON_HISTORIAL");
    expect((await dueno("delete", `/mesas/${id}`)).status).toBe(204);
    expect(await lista()).toHaveLength(3);
  });

  it("motorizados: crea con celular normalizado, edita, desactiva y elimina", async () => {
    const nuevo = await dueno("post", "/repartidores", { nombre: "José Falcón", telefono: "+51 916 386 642" });
    const id = nuevo.body.id as string;
    const lista = async () => (await dueno("get", "/repartidores")).body.repartidores as { id: string; nombre: string; telefono: string | null; activo: boolean; eliminable: boolean }[];

    expect(nuevo.status).toBe(201);
    expect((await lista()).find((r) => r.id === id)).toMatchObject({ nombre: "José Falcón", telefono: "916386642", activo: true, eliminable: true });

    expect((await dueno("patch", `/repartidores/${id}`, { telefono: "", activo: false })).status).toBe(204);
    expect((await lista()).find((r) => r.id === id)).toMatchObject({ telefono: null, activo: false });
    const enDelivery = (await request(app).get("/api/repartidores").set(conToken(caja))).body.repartidores as { id: string }[];
    expect(enDelivery.map((r) => r.id)).toEqual([a.repartidor.id]);

    // El que ya llevó un pedido no se elimina
    const pedido = await crearPedido(caja, { tipo: "DELIVERY", items: [{ varianteId: a.v.ceviche }], cliente: { telefono: "987654321", nombre: "Ana", direccion: "Jr. Lima 123" } });
    await prisma.pedido.update({ where: { id: pedido.body.pedido.id }, data: { repartidorId: a.repartidor.id } });
    expect((await dueno("delete", `/repartidores/${a.repartidor.id}`)).body.error.codigo).toBe("CON_HISTORIAL");
    expect((await dueno("delete", `/repartidores/${id}`)).status).toBe(204);
    expect((await dueno("post", "/repartidores", { nombre: "X", telefono: "12" })).status).toBe(400);
  });

  it("notas rápidas: crea, ordena, desactiva y elimina", async () => {
    const [sinAji, paraLlevar] = [await dueno("post", "/notas", { texto: "sin ají" }), await dueno("post", "/notas", { texto: "bien cocido" })];
    const textos = async () => (await dueno("get", "/notas")).body.notas.map((n: { texto: string }) => n.texto);

    expect([sinAji.status, paraLlevar.status]).toEqual([201, 201]);
    expect(await textos()).toEqual(["sin ají", "bien cocido"]);

    await dueno("post", `/notas/${paraLlevar.body.id}/mover`, { direccion: "subir" });
    expect(await textos()).toEqual(["bien cocido", "sin ají"]);
    expect((await carta()).notasRapidas.map((n: { texto: string }) => n.texto)).toEqual(["bien cocido", "sin ají"]);

    expect((await dueno("patch", `/notas/${sinAji.body.id}`, { texto: "sin ají ni cebolla", activo: false })).status).toBe(204);
    expect((await carta()).notasRapidas.map((n: { texto: string }) => n.texto)).toEqual(["bien cocido"]);
    expect((await dueno("delete", `/notas/${paraLlevar.body.id}`)).status).toBe(204);
    expect(await textos()).toEqual(["sin ají ni cebolla"]);
    expect((await dueno("post", "/notas", { texto: "" })).status).toBe(400);
  });
});

describe("negocio", () => {
  // PNG de 1×1
  const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
  const subir = (token: string, imagen: Buffer, tipo = "image/png") =>
    request(app).put("/api/admin/negocio/logo").set(conToken(token)).set("Content-Type", tipo).send(imagen);

  it("lee y cambia los datos del negocio; la carta los refleja", async () => {
    const antes = await dueno("get", "/negocio");
    const res = await dueno("patch", "/negocio", {
      nombre: "Cevichería A", costoEnvioDefault: 4, precioTaper: 1.5, distritos: ["Morales", "Tarapoto", "La Banda"], umbralTardaMin: 10, umbralMuyTardeMin: 20,
    });
    const delMozo = await carta();

    expect(antes.body.negocio).toMatchObject({ codigo: "negocio-a", nombre: "Negocio A", costoEnvioDefault: "3.00", precioTaper: "1.00", umbralTardaMin: 15, umbralMuyTardeMin: 25 });
    expect(JSON.stringify(antes.body)).not.toContain('"logo"');
    expect(res.status).toBe(200);
    expect(res.body.negocio).toMatchObject({ nombre: "Cevichería A", costoEnvioDefault: "4.00", precioTaper: "1.50", distritos: ["Morales", "Tarapoto", "La Banda"] });
    expect(delMozo.cocina).toEqual({ tardaMin: 10, muyTardeMin: 20 });
    expect(delMozo.reparto).toMatchObject({ costoEnvioDefault: "4.00", precioTaper: "1.50", distritos: ["Morales", "Tarapoto", "La Banda"] });
    // El otro negocio no se enteró
    expect((await prisma.negocio.findUniqueOrThrow({ where: { id: b.negocio.id }, select: { nombre: true } })).nombre).toBe("Negocio B");
  });

  it("rechaza datos sin sentido", async () => {
    const malos = [
      {},
      { nombre: "" },
      { costoEnvioDefault: -1 },
      { precioTaper: 50 },
      { distritos: ["Tarapoto", "tarapoto"] },
      { umbralTardaMin: 30 }, // el rojo (25) llegaría antes que el ámbar
      { umbralTardaMin: 20, umbralMuyTardeMin: 20 },
    ];
    for (const cuerpo of malos) expect((await dueno("patch", "/negocio", cuerpo)).status).toBe(400);
  });

  it("sube el logo, lo sirve con dirección nueva y lo quita", async () => {
    const res = await subir(admin, PNG);
    const url = res.body.negocio.logoUrl as string;
    const imagen = await request(app).get(url);
    const publico = await request(app).get("/api/negocios/negocio-a/publico");

    expect(res.status).toBe(200);
    expect(url).toMatch(/^\/api\/negocios\/negocio-a\/logo\?v=\d+$/);
    expect(imagen.status).toBe(200);
    expect(imagen.headers["content-type"]).toBe("image/png");
    expect(Buffer.compare(imagen.body, PNG)).toBe(0);
    expect(publico.body.logoUrl).toBe(url);

    const sinLogo = await dueno("delete", "/negocio/logo");
    expect(sinLogo.body.negocio.logoUrl).toBeNull();
    expect((await request(app).get("/api/negocios/negocio-a/logo")).status).toBe(404);
  });

  it("no acepta lo que no es una imagen ni archivos de más de 1 MB", async () => {
    const disfrazado = await subir(admin, Buffer.from("<svg onload=alert(1)>"), "image/png");
    const otroTipo = await subir(admin, PNG, "image/svg+xml");
    const enorme = await subir(admin, Buffer.concat([PNG, Buffer.alloc(1024 * 1024)]));

    expect([disfrazado.status, otroTipo.status, enorme.status]).toEqual([400, 400, 413]);
    expect((await prisma.negocio.findUniqueOrThrow({ where: { id: a.negocio.id }, select: { logoUrl: true } })).logoUrl).toBeNull();
  });
});

describe("reportes", () => {
  const reporte = (rango = `desde=${hoy()}&hasta=${hoy()}`) => dueno("get", `/reportes?${rango}`);
  const pagar = (pedidoId: string, pagos: object[]) => request(app).post(`/api/pedidos/${pedidoId}/pagos`).set(conToken(caja)).send({ pagos });

  it("sin movimiento, todo sale en cero", async () => {
    const res = await reporte();

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      desde: hoy(),
      hasta: hoy(),
      ventas: {
        total: "0.00", pedidos: 0, ticketPromedio: "0.00",
        porMetodo: { EFECTIVO: "0.00", YAPE: "0.00", PLIN: "0.00", TARJETA: "0.00" },
        porTipo: { MESA: "0.00", PARA_LLEVAR: "0.00", DELIVERY: "0.00" },
        porDia: [{ fecha: hoy(), total: "0.00", pedidos: 0 }],
      },
      porCobrar: { total: "0.00", pedidos: 0 },
      pedidosTomados: 0,
      platos: [],
      cocina: { promedioMin: null, platos: 0, porArea: [] },
      turnos: [],
      correcciones: [],
    });
    expect(res.body.porHora).toHaveLength(24);
  });

  it("las ventas son lo cobrado: los pagos anulados no cuentan y lo pendiente va aparte", async () => {
    await request(app).post("/api/caja/abrir").set(conToken(caja)).send({ montoInicial: 50 });
    // Mesa 1: 2 ceviches + gaseosa = 43, pagado mitad Yape, mitad efectivo
    const mesa = await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.ceviche, cantidad: 2 }, { varianteId: a.v.gaseosa }] });
    await pagar(mesa.body.pedido.id, [{ metodo: "YAPE", monto: 20 }, { metodo: "EFECTIVO", monto: 23, recibido: 50 }]);
    // Para llevar: leche de tigre (12) + taper (1) = 13, cobrado con tarjeta y luego anulado
    const llevar = await crearPedido(mozo, { items: [{ varianteId: a.v.leche }] });
    const cobro = await pagar(llevar.body.pedido.id, [{ metodo: "TARJETA", monto: 13 }]);
    const { id: pagoId } = await prisma.pago.findFirstOrThrow({ where: { pedidoId: llevar.body.pedido.id } });
    await request(app).patch(`/api/pedidos/${llevar.body.pedido.id}/pagos/${pagoId}/anular`).set(conToken(caja)).send({ motivo: "Se cobró dos veces" });
    // Mesa 2: un ceviche sin cobrar, y un pedido cancelado que no cuenta para nada
    await crearPedido(mozo, { mesaId: a.mesas[1].id, items: [{ varianteId: a.v.ceviche }] });
    const cancelado = await crearPedido(caja, { tipo: "DELIVERY", items: [{ varianteId: a.v.combo, componentes: [a.productos.ceviche.id, a.productos.leche.id] }], cliente: { telefono: "987654321", nombre: "Ana", direccion: "Jr. Lima 123" } });
    await request(app).patch(`/api/pedidos/${cancelado.body.pedido.id}/cancelar`).set(conToken(caja)).send({ motivo: "Se arrepintió" });
    // Un plato listo a los 12 minutos
    const item = mesa.body.pedido.items[0].id as string;
    const creado = (await prisma.pedidoItem.findUniqueOrThrow({ where: { id: item } })).creadoEn;
    await prisma.pedidoItem.update({ where: { id: item }, data: { listoEn: new Date(creado.getTime() + 12 * 60_000) } });
    // Lo del otro negocio no se mezcla
    const cajaB = await tokenDe(b, "cocina");
    await request(app).post("/api/caja/abrir").set(conToken(cajaB)).send({ montoInicial: 0 });
    const ajeno = await crearPedido(await tokenDe(b, "mozo"), { mesaId: b.mesas[0].id, items: [{ varianteId: b.v.ceviche }] });
    await request(app).post(`/api/pedidos/${ajeno.body.pedido.id}/pagos`).set(conToken(cajaB)).send({ pagos: [{ metodo: "PLIN", monto: 20 }] });

    const res = await reporte();

    expect(cobro.status).toBe(201);
    expect(res.body.ventas).toMatchObject({
      total: "43.00", pedidos: 1, ticketPromedio: "43.00",
      porMetodo: { EFECTIVO: "23.00", YAPE: "20.00", PLIN: "0.00", TARJETA: "0.00" },
      porTipo: { MESA: "43.00", PARA_LLEVAR: "0.00", DELIVERY: "0.00" },
      porDia: [{ fecha: hoy(), total: "43.00", pedidos: 1 }],
    });
    expect(res.body.porCobrar).toEqual({ total: "33.00", pedidos: 2 });
    expect(res.body.pedidosTomados).toBe(3);
    expect(res.body.platos).toEqual([
      { nombre: "Ceviche Simple", cantidad: 3, total: "60.00" },
      { nombre: "Gaseosa Personal", cantidad: 1, total: "3.00" },
      { nombre: "Leche de Tigre", cantidad: 1, total: "12.00" },
    ]);
    expect(res.body.porHora.reduce((n: number, h: { pedidos: number }) => n + h.pedidos, 0)).toBe(3);
    expect(res.body.cocina).toEqual({ promedioMin: 12, platos: 1, porArea: [{ area: "Cocina", promedioMin: 12, platos: 1 }] });
    expect(res.body.turnos).toHaveLength(1);
    expect(res.body.turnos[0]).toMatchObject({ abierto: true, totalCobrado: "43.00", pagosAnulados: 1, efectivoEsperado: "73.00" });
    expect(res.body.correcciones).toMatchObject([{ tipo: "ANULACION", usuario: "cocina", monto: "13.00", pedido: { numero: 2 }, detalle: { motivo: "Se cobró dos veces" } }]);
  });

  it("solo cuenta los días pedidos, en la hora del negocio", async () => {
    await request(app).post("/api/caja/abrir").set(conToken(caja)).send({ montoInicial: 0 });
    const pedido = await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.ceviche }] });
    await pagar(pedido.body.pedido.id, [{ metodo: "YAPE", monto: 20 }]);
    // Cobrado ayer a las 23:30 de Lima (ya es "hoy" en UTC)
    const ayer = new Date(Date.parse(`${hoy()}T04:30:00Z`));
    await prisma.pago.updateMany({ data: { creadoEn: ayer } });
    const diaAnterior = new Date(Date.parse(hoy()) - 86_400_000).toISOString().slice(0, 10);

    const deHoy = await reporte();
    const deAyer = await reporte(`desde=${diaAnterior}&hasta=${hoy()}`);

    expect(deHoy.body.ventas.total).toBe("0.00");
    expect(deAyer.body.ventas.porDia).toEqual([{ fecha: diaAnterior, total: "20.00", pedidos: 1 }, { fecha: hoy(), total: "0.00", pedidos: 0 }]);
  });

  it("rechaza rangos mal escritos", async () => {
    const malos = ["", "desde=2026-10-07", "desde=07/10/2026&hasta=07/10/2026", "desde=2026-10-08&hasta=2026-10-07", "desde=2024-01-01&hasta=2026-10-07"];
    for (const rango of malos) expect((await reporte(rango)).status).toBe(400);
  });
});
