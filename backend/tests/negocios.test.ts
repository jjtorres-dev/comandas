import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { intentosDeLogin } from "../src/modules/auth/auth.routes";
import { consultasDeLogo, consultasDeNegocio } from "../src/modules/negocios/negocios.routes";
import { app, CLAVE, conToken, crearNegocio, limpiarBase, prisma, tokenDe, type NegocioDePrueba } from "./helpers";

const LOGO = "/api/negocios/negocio-a/logo?v=1";
// Un PNG mínimo (1×1) como logo de prueba
const IMAGEN = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

let a: NegocioDePrueba;
let b: NegocioDePrueba;

beforeEach(async () => {
  await limpiarBase();
  intentosDeLogin.resetAll();
  consultasDeNegocio.resetAll();
  consultasDeLogo.resetAll();
  a = await crearNegocio("Negocio A", "negocio-a", LOGO);
  b = await crearNegocio("Negocio B", "negocio-b");
});

afterAll(() => prisma.$disconnect());

const publico = (codigo: string) => request(app).get(`/api/negocios/${codigo}/publico`);

describe("GET /api/negocios/:codigo/publico", () => {
  it("sin token devuelve solo el nombre y el logo", async () => {
    const conLogo = await publico("negocio-a");
    const sinLogo = await publico("negocio-b");

    expect(conLogo.status).toBe(200);
    expect(conLogo.body).toEqual({ nombre: "Negocio A", logoUrl: LOGO });
    expect(sinLogo.body).toEqual({ nombre: "Negocio B", logoUrl: null });
  });

  it("el código no distingue mayúsculas", async () => {
    const res = await publico("NEGOCIO-A");

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBe("Negocio A");
  });

  it("responde 404 si el código no existe o el negocio está inactivo", async () => {
    await prisma.negocio.update({ where: { id: b.negocio.id }, data: { activo: false } });

    for (const res of [await publico("no-existe"), await publico("negocio-b")]) {
      expect(res.status).toBe(404);
      expect(res.body.error).toEqual({ codigo: "NO_ENCONTRADO", mensaje: "No existe un negocio con ese código" });
    }
  });

  it("limita a 30 consultas por minuto por IP", async () => {
    for (let i = 0; i < 30; i++) expect((await publico("negocio-a")).status).toBe(200);
    const siguiente = await publico("negocio-a");

    expect(siguiente.status).toBe(429);
    expect(siguiente.body.error.codigo).toBe("DEMASIADOS_INTENTOS");
  });
});

describe("logo del negocio en la sesión", () => {
  it("el login devuelve el logoUrl del negocio", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ codigoNegocio: "negocio-a", usuario: "mozo", password: CLAVE });

    expect(res.status).toBe(200);
    expect(res.body.negocio).toEqual({ id: a.negocio.id, codigo: "negocio-a", nombre: "Negocio A", logoUrl: LOGO });
  });

  it("GET /api/auth/yo devuelve el usuario y su negocio", async () => {
    const res = await request(app).get("/api/auth/yo").set(conToken(await tokenDe(a, "cocina")));

    expect(res.status).toBe(200);
    expect(res.body.usuario).toMatchObject({ nombre: "cocina", usuario: "cocina", roles: ["LOCAL"] });
    expect(res.body.usuario.id).toBeTypeOf("string");
    expect(res.body.negocio).toEqual({ id: a.negocio.id, codigo: "negocio-a", nombre: "Negocio A", logoUrl: LOGO });
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
  });

  it("GET /api/auth/yo devuelve el negocio del token, nunca otro", async () => {
    const res = await request(app).get("/api/auth/yo").set(conToken(await tokenDe(b, "admin")));

    expect(res.body.negocio).toEqual({ id: b.negocio.id, codigo: "negocio-b", nombre: "Negocio B", logoUrl: null });
  });

  it("GET /api/auth/yo sin token responde 401", async () => {
    const res = await request(app).get("/api/auth/yo");

    expect(res.status).toBe(401);
    expect(res.body.error.codigo).toBe("NO_AUTENTICADO");
  });
});

describe("GET /api/negocios/:codigo/logo", () => {
  it("sirve la imagen guardada en la base, sin autenticación y con su tipo", async () => {
    await prisma.negocio.update({ where: { id: a.negocio.id }, data: { logo: IMAGEN, logoTipo: "image/png" } });

    const res = await request(app).get("/api/negocios/negocio-a/logo");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("image/png");
    expect(res.headers["cache-control"]).toContain("max-age");
    expect(Buffer.compare(res.body, IMAGEN)).toBe(0);
  });

  it("404 si el negocio no tiene logo o no existe; /uploads ya no se sirve", async () => {
    expect((await request(app).get("/api/negocios/negocio-b/logo")).status).toBe(404);
    expect((await request(app).get("/api/negocios/no-existe/logo")).status).toBe(404);
    expect((await request(app).get("/uploads/negocios/valentina.png")).status).toBe(404);
  });

  it("la imagen no viaja en las respuestas del negocio", async () => {
    await prisma.negocio.update({ where: { id: a.negocio.id }, data: { logo: IMAGEN, logoTipo: "image/png" } });
    const res = await request(app).get("/api/negocios/negocio-a/publico");
    expect(Object.keys(res.body)).toEqual(["nombre", "logoUrl"]);
  });
});
