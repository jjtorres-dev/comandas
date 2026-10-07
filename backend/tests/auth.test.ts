import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { esOrigenPermitido } from "../src/config/cors";
import { leerTrustProxy } from "../src/config/env";
import { intentosDeLogin } from "../src/modules/auth/auth.routes";
import {
  app,
  CLAVE,
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

beforeEach(async () => {
  await limpiarBase();
  intentosDeLogin.resetAll();
  a = await crearNegocio("Negocio A", "negocio-a");
  b = await crearNegocio("Negocio B", "negocio-b");
});

afterAll(() => prisma.$disconnect());

const entrar = (codigoNegocio: string, usuario: string, password = CLAVE) =>
  request(app).post("/api/auth/login").send({ codigoNegocio, usuario, password });

describe("POST /api/auth/login", () => {
  it("entra con código de negocio, usuario y contraseña, y devuelve el JWT", async () => {
    const res = await entrar("negocio-a", "mozo");

    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ usuario: "mozo", roles: ["MOZO"] });
    expect(res.body.negocio).toEqual({ id: a.negocio.id, codigo: "negocio-a", nombre: "Negocio A", logoUrl: null });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");

    const payload = jwt.decode(res.body.token) as Record<string, unknown>;
    expect(payload).toMatchObject({ usuarioId: res.body.usuario.id, negocioId: a.negocio.id, roles: ["MOZO"] });
    expect(payload.exp).toBeTypeOf("number");
  });

  it("el mismo usuario en dos negocios entra a cada uno por su código", async () => {
    await prisma.usuario.updateMany({ where: { negocioId: b.negocio.id }, data: { nombre: "de B" } });

    const enA = await entrar("negocio-a", "admin");
    const enB = await entrar(" Negocio-B ", "admin"); // el código no distingue mayúsculas ni espacios

    expect(enA.body.negocio.id).toBe(a.negocio.id);
    expect(enB.body.negocio.id).toBe(b.negocio.id);
    expect(enB.body.usuario.nombre).toBe("de B");
  });

  it("rechaza con 401 código, usuario o contraseña incorrectos, con el mismo mensaje", async () => {
    const respuestas = await Promise.all([
      entrar("no-existe", "mozo"),
      entrar("negocio-a", "nadie"),
      entrar("negocio-a", "mozo", "mala"),
    ]);

    for (const res of respuestas) {
      expect(res.status).toBe(401);
      expect(res.body.error).toEqual({ codigo: "NO_AUTENTICADO", mensaje: "Negocio, usuario o contraseña incorrectos" });
    }
  });

  it("rechaza usuarios y negocios inactivos", async () => {
    await prisma.usuario.updateMany({ where: { negocioId: a.negocio.id, usuario: "cocina" }, data: { activo: false } });
    await prisma.negocio.update({ where: { id: b.negocio.id }, data: { activo: false } });

    expect((await entrar("negocio-a", "cocina")).status).toBe(401);
    expect((await entrar("negocio-b", "mozo")).status).toBe(401);
  });

  it("valida el cuerpo con 400", async () => {
    const res = await request(app).post("/api/auth/login").send({ usuario: "mozo", password: CLAVE });

    expect(res.status).toBe(400);
    expect(res.body.error.codigo).toBe("DATOS_INVALIDOS");
    expect(res.body.error.detalles[0].campo).toBe("codigoNegocio");
  });

  it("limita a 5 intentos fallidos por minuto; los correctos no cuentan", async () => {
    for (let i = 0; i < 6; i++) expect((await entrar("negocio-a", "mozo")).status).toBe(200);

    for (let i = 0; i < 5; i++) expect((await entrar("negocio-a", "mozo", "mala")).status).toBe(401);
    const sexto = await entrar("negocio-a", "mozo", "mala");
    const conClaveCorrecta = await entrar("negocio-a", "mozo");

    expect(sexto.status).toBe(429);
    expect(sexto.body.error).toEqual({
      codigo: "DEMASIADOS_INTENTOS",
      mensaje: "Demasiados intentos. Espera un minuto y vuelve a probar",
    });
    expect(conClaveCorrecta.status).toBe(429);
  });
});

describe("requireAuth y requireRol", () => {
  it("sin token o con token alterado responde 401", async () => {
    const token = await tokenDe(a, "mozo");

    const sinToken = await request(app).get("/api/carta");
    const alterado = await request(app).get("/api/carta").set(conToken(`${token}x`));
    const otroSecreto = jwt.sign({ usuarioId: "x", negocioId: a.negocio.id, roles: ["ADMIN"] }, "otro-secreto");
    const falsificado = await request(app).get("/api/carta").set(conToken(otroSecreto));

    expect(sinToken.status).toBe(401);
    expect(alterado.status).toBe(401);
    expect(falsificado.status).toBe(401);
  });

  it("un usuario desactivado deja de entrar con su token (401)", async () => {
    const token = await tokenDe(a, "mozo");
    expect((await request(app).get("/api/carta").set(conToken(token))).status).toBe(200);

    await prisma.usuario.updateMany({ where: { negocioId: a.negocio.id, usuario: "mozo" }, data: { activo: false } });
    const carta = await request(app).get("/api/carta").set(conToken(token));
    const pedido = await crearPedido(token, { items: [{ varianteId: a.v.ceviche }] });

    expect(carta.status).toBe(401);
    expect(carta.body.error.mensaje).toBe("Tu sesión ya no es válida. Vuelve a iniciar sesión");
    expect(pedido.status).toBe(401);
    expect(await prisma.pedido.count()).toBe(0);
  });

  it("si cambian los roles del usuario, el token anterior deja de valer (401)", async () => {
    const eraAdmin = await tokenDe(a, "admin");
    await prisma.usuario.updateMany({ where: { negocioId: a.negocio.id, usuario: "admin" }, data: { roles: ["MOZO"] } });

    const conTokenViejo = await request(app).get("/api/caja/actual").set(conToken(eraAdmin));
    const conTokenNuevo = await request(app).get("/api/caja/actual").set(conToken(await tokenDe(a, "admin")));

    expect(conTokenViejo.status).toBe(401);
    expect(conTokenNuevo.status).toBe(403); // ya es solo MOZO
  });

  it("un negocio desactivado invalida las sesiones de sus usuarios", async () => {
    const token = await tokenDe(b, "admin");
    await prisma.negocio.update({ where: { id: b.negocio.id }, data: { activo: false } });

    expect((await request(app).get("/api/carta").set(conToken(token))).status).toBe(401);
  });

  it("ADMIN también crea pedidos y agrega rondas", async () => {
    const admin = await tokenDe(a, "admin");

    const creado = await crearPedido(admin, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.ceviche }] });
    const ronda = await request(app)
      .post(`/api/pedidos/${creado.body.pedido.id}/items`)
      .set(conToken(admin))
      .send({ idRonda: "c1b4f0a2-5d3e-4e6f-8a7b-9c0d1e2f3a4b", items: [{ varianteId: a.v.leche, cantidad: 1 }] });

    expect([creado.status, ronda.status]).toEqual([201, 201]);
    expect(ronda.body.pedido.total).toBe("32.00");
  });

  it("un MOZO no entra a caja ni cobra (403)", async () => {
    const mozo = await tokenDe(a, "mozo");
    const { body } = await crearPedido(mozo, { items: [{ varianteId: a.v.ceviche }] });

    const respuestas = await Promise.all([
      request(app).get("/api/caja/actual").set(conToken(mozo)),
      request(app).post("/api/caja/abrir").set(conToken(mozo)).send({ montoInicial: 0 }),
      request(app).post(`/api/pedidos/${body.pedido.id}/pagos`).set(conToken(mozo)).send({ pagos: [{ metodo: "YAPE", monto: 20 }] }),
      request(app).patch(`/api/pedidos/${body.pedido.id}/cargos`).set(conToken(mozo)).send({ descuento: 1 }),
    ]);

    for (const res of respuestas) {
      expect(res.status).toBe(403);
      expect(res.body.error.codigo).toBe("SIN_PERMISO");
    }
  });

  it("una ruta inexistente responde 404 en JSON", async () => {
    const res = await request(app).get("/api/no-existe");

    expect(res.status).toBe(404);
    expect(res.body.error.codigo).toBe("NO_ENCONTRADO");
  });
});

describe("TRUST_PROXY", () => {
  it("vacío no confía en ningún proxy; un número indica cuántos hay delante", () => {
    expect(leerTrustProxy(undefined)).toBeUndefined();
    expect(leerTrustProxy("")).toBeUndefined();
    expect(leerTrustProxy("  ")).toBeUndefined();
    expect(leerTrustProxy("1")).toBe(1); // Railway
    expect(leerTrustProxy("true")).toBe(true);
    expect(leerTrustProxy("false")).toBe(false);
    expect(leerTrustProxy("loopback, 10.0.0.0/8")).toBe("loopback, 10.0.0.0/8");
  });
});

describe("CORS", () => {
  const frontendUrl = "http://localhost:5173";

  it("permite el FRONTEND_URL y, solo en desarrollo, las IPs 192.168.x.x", () => {
    const dev = { frontendUrl, desarrollo: true };
    const prod = { frontendUrl, desarrollo: false };

    expect(esOrigenPermitido("http://localhost:5173", prod)).toBe(true);
    expect(esOrigenPermitido(undefined, prod)).toBe(true); // curl y apps nativas
    expect(esOrigenPermitido("http://192.168.1.50:5173", dev)).toBe(true);
    expect(esOrigenPermitido("http://192.168.0.7", dev)).toBe(true);

    expect(esOrigenPermitido("http://192.168.1.50:5173", prod)).toBe(false);
    expect(esOrigenPermitido("https://sitio-ajeno.com", dev)).toBe(false);
    expect(esOrigenPermitido("http://10.0.0.5:5173", dev)).toBe(false);
    expect(esOrigenPermitido("http://192.168.1.50.sitio-ajeno.com", dev)).toBe(false);
    expect(esOrigenPermitido("http://localhost:9999", dev)).toBe(false);
  });

  it("responde las cabeceras solo al origen permitido", async () => {
    const propio = await request(app).get("/api/salud").set("Origin", frontendUrl);
    const ajeno = await request(app).get("/api/salud").set("Origin", "https://sitio-ajeno.com");
    const preflight = await request(app)
      .options("/api/pedidos")
      .set("Origin", frontendUrl)
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type");

    expect(propio.headers["access-control-allow-origin"]).toBe(frontendUrl);
    expect(ajeno.headers["access-control-allow-origin"]).toBeUndefined();
    expect(preflight.status).toBe(204);
    expect(preflight.headers["access-control-allow-headers"]).toBe("authorization,content-type");
  });
});
