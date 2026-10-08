import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import express from "express";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { leerEntorno } from "../src/config/env";
import { servirFrontend } from "../src/frontend";
import { diaYHora, fechaHoraLocal, inicioDeFecha, inicioDelDia } from "../src/lib/tiempo";
import { rutaNoEncontrada } from "../src/middlewares/errores";
import { intentosDeLogin } from "../src/modules/auth/auth.routes";
import { consultasDeLogo } from "../src/modules/negocios/negocios.routes";
import { sembrarProduccion } from "../src/seed/produccion";
import { app, conToken, crearNegocio, crearPedido, limpiarBase, prisma, tokenDe } from "./helpers";

beforeEach(async () => {
  await limpiarBase();
  consultasDeLogo.resetAll();
  intentosDeLogin.resetAll();
});

afterEach(() => vi.restoreAllMocks());
afterAll(() => prisma.$disconnect());

describe("variables de entorno", () => {
  const SECRETO = "0123456789abcdef0123456789abcdef";
  const completas = { NODE_ENV: "production", DATABASE_URL: "postgresql://u:c@host:5432/base", JWT_SECRET: SECRETO, PORT: "8080", TRUST_PROXY: "1" };

  it("acepta un entorno de producción completo", () => {
    const leido = leerEntorno(completas);
    expect(leido).toMatchObject({ ok: true, env: { NODE_ENV: "production", PORT: 8080, TRUST_PROXY: 1 } });
  });

  it("en producción dice una por una las que faltan o están mal", () => {
    const leido = leerEntorno({ NODE_ENV: "production" });
    const problemas = leido.ok ? [] : leido.problemas;

    expect(leido.ok).toBe(false);
    for (const variable of ["DATABASE_URL", "JWT_SECRET", "PORT", "TRUST_PROXY"]) {
      expect(problemas.some((p) => p.startsWith(`${variable}:`)), variable).toBe(true);
    }
    expect(leerEntorno({ ...completas, JWT_SECRET: "corto" })).toMatchObject({ ok: false, problemas: [expect.stringContaining("al menos 32 caracteres")] });
    expect(leerEntorno({ ...completas, JWT_SECRET: "cambia-este-secreto-por-uno-largo-y-aleatorio" })).toMatchObject({ ok: false, problemas: [expect.stringContaining("secreto de ejemplo")] });
    expect(leerEntorno({ ...completas, DATABASE_URL: "mysql://x" }).ok).toBe(false);
    expect(leerEntorno({ ...completas, PORT: "ochenta" }).ok).toBe(false);
    expect(leerEntorno({ ...completas, NODE_ENV: "produccion" }).ok).toBe(false);
    expect(leerEntorno({ ...completas, TRUST_PROXY: " " }).ok).toBe(false);
  });

  it("en desarrollo PORT y TRUST_PROXY tienen valores por defecto", () => {
    const leido = leerEntorno({ DATABASE_URL: completas.DATABASE_URL, JWT_SECRET: SECRETO });
    expect(leido).toMatchObject({ ok: true, env: { NODE_ENV: "development", PORT: 3000 } });
    expect(leido.ok && leido.env.TRUST_PROXY).toBeUndefined();
  });
});

// El servidor de Railway corre en UTC; el negocio vive en Lima (UTC-5, sin
// horario de verano). Estas cuentas no dependen de la zona del proceso.
describe("zona horaria del negocio", () => {
  it("el día empieza a la medianoche de Lima, no a la de UTC", () => {
    // 22:30 del 7 de octubre en Lima ya es 8 de octubre en UTC
    const noche = new Date("2026-10-08T03:30:00Z");

    expect(inicioDelDia(noche).toISOString()).toBe("2026-10-07T05:00:00.000Z");
    expect(inicioDelDia(new Date("2026-10-08T05:00:00Z")).toISOString()).toBe("2026-10-08T05:00:00.000Z");
    expect(inicioDelDia(new Date("2026-10-08T04:59:59Z")).toISOString()).toBe("2026-10-07T05:00:00.000Z");
    expect(inicioDeFecha("2026-10-07").toISOString()).toBe("2026-10-07T05:00:00.000Z");
    expect(inicioDeFecha("2026-12-31").toISOString()).toBe("2026-12-31T05:00:00.000Z");
    expect(diaYHora(noche)).toEqual({ dia: "2026-10-07", hora: 22 });
    expect(diaYHora(new Date("2026-10-08T05:00:00Z"))).toEqual({ dia: "2026-10-08", hora: 0 });
    expect(fechaHoraLocal(noche)).toBe("07/10/2026, 22:30");
  });

  it("el correlativo no se reinicia a la medianoche de UTC (7 p. m. en Lima), sino a la de Lima", async () => {
    const a = await crearNegocio("Negocio A", "negocio-a");
    const mozo = await tokenDe(a, "mozo");
    const pedir = () => crearPedido(mozo, { items: [{ varianteId: a.v.ceviche }] });
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      // 6:50 p. m. y 7:10 p. m. de Lima: entre los dos cambia el día en UTC
      vi.setSystemTime(new Date("2026-10-07T23:50:00Z"));
      const antes = await pedir();
      vi.setSystemTime(new Date("2026-10-08T00:10:00Z"));
      const despues = await pedir();
      // 11:50 p. m. y 12:10 a. m. de Lima: aquí sí empieza otro día
      vi.setSystemTime(new Date("2026-10-08T04:50:00Z"));
      const ultimo = await pedir();
      vi.setSystemTime(new Date("2026-10-08T05:10:00Z"));
      const delDiaSiguiente = await pedir();

      expect([antes, despues, ultimo, delDiaSiguiente].map((r) => r.body.pedido?.numero)).toEqual([1, 2, 3, 1]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("la nota de venta y el reporte de 'hoy' usan la hora de Lima", async () => {
    const a = await crearNegocio("Negocio A", "negocio-a");
    const [mozo, caja, admin] = await Promise.all([tokenDe(a, "mozo"), tokenDe(a, "cocina"), tokenDe(a, "admin")]);
    await request(app).post("/api/caja/abrir").set(conToken(caja)).send({ montoInicial: 0 });
    const { body } = await crearPedido(mozo, { mesaId: a.mesas[0].id, items: [{ varianteId: a.v.ceviche }] });
    await request(app).post(`/api/pedidos/${body.pedido.id}/pagos`).set(conToken(caja)).send({ pagos: [{ metodo: "YAPE", monto: 20 }] });
    // Todo pasó a las 9:15 p. m. del 7 de octubre en Lima (2:15 a. m. del 8 en UTC)
    const cuando = new Date("2026-10-08T02:15:00Z");
    await prisma.pedido.updateMany({ data: { creadoEn: cuando } });
    await prisma.pago.updateMany({ data: { creadoEn: cuando } });
    await prisma.turnoCaja.updateMany({ data: { abiertoEn: cuando } });

    const nota = await request(app).get(`/api/pedidos/${body.pedido.id}/nota-venta`).set(conToken(caja));
    const reporte = (dia: string) => request(app).get(`/api/admin/reportes?desde=${dia}&hasta=${dia}`).set(conToken(admin));
    const [del7, del8] = await Promise.all([reporte("2026-10-07"), reporte("2026-10-08")]);

    expect(JSON.stringify(nota.body)).toContain("07/10/2026, 21:15");
    expect(del7.body.ventas.total).toBe("20.00");
    expect(del7.body.turnos).toHaveLength(1);
    expect(del7.body.porHora[21]).toEqual({ hora: 21, pedidos: 1 });
    expect(del8.body.ventas.total).toBe("0.00");
    expect(del8.body.turnos).toHaveLength(0);
  });
});

describe("seguridad y operación", () => {
  it("GET /api/salud comprueba la base", async () => {
    const sana = await request(app).get("/api/salud");
    vi.spyOn(prisma, "$queryRaw").mockRejectedValueOnce(new Error("connect ECONNREFUSED"));
    const caida = await request(app).get("/api/salud");

    expect(sana.status).toBe(200);
    expect(sana.body).toEqual({ ok: true });
    expect(caida.status).toBe(503);
    expect(caida.body).toEqual({ ok: false, error: { codigo: "BASE_NO_DISPONIBLE", mensaje: expect.any(String) } });
    expect(JSON.stringify(caida.body)).not.toContain("ECONNREFUSED");
  });

  it("responde con cabeceras de seguridad, sin caché en la API y con id de petición", async () => {
    const res = await request(app).get("/api/salud");
    const csp = res.headers["content-security-policy"];

    for (const regla of ["default-src 'self'", "script-src 'self'", "connect-src 'self'", "object-src 'none'", "frame-ancestors 'none'", "img-src 'self' data: blob: https:"]) {
      expect(csp, regla).toContain(regla);
    }
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.headers["x-request-id"]).toMatch(/^[\w-]{8,64}$/);
    // Si el proxy ya trae un id, se respeta; uno raro se descarta
    expect((await request(app).get("/api/salud").set("X-Request-Id", "abc-12345678")).headers["x-request-id"]).toBe("abc-12345678");
    expect((await request(app).get("/api/salud").set("X-Request-Id", "<script>")).headers["x-request-id"]).not.toBe("<script>");
  });

  it("un error inesperado no expone la traza ni el mensaje interno", async () => {
    vi.spyOn(prisma.negocio, "findFirst").mockRejectedValueOnce(new Error("clave secreta de la base: hunter2"));
    const res = await request(app).get("/api/negocios/negocio-a/publico");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor", idPeticion: res.headers["x-request-id"] } });
    expect(res.text).not.toMatch(/hunter2|at .*\.ts|stack/);
  });

  it("rechaza cuerpos de más de 100 kB", async () => {
    const res = await request(app).post("/api/auth/login").send({ codigoNegocio: "x", usuario: "y", password: "z".repeat(150_000) });
    expect(res.status).toBe(413);
    expect(res.body.error.codigo).toBe("CUERPO_MUY_GRANDE");
  });

  it("el logo tiene límite de consultas por IP", async () => {
    let ultima = 200;
    for (let i = 0; i < 61; i++) ultima = (await request(app).get("/api/negocios/no-existe/logo")).status;
    // Las 60 primeras responden (404: no existe); la 61 ya no
    expect(ultima).toBe(429);
  });
});

describe("un solo servicio: el backend sirve el frontend", () => {
  const carpeta = mkdtempSync(path.join(tmpdir(), "comandas-frontend-"));
  mkdirSync(path.join(carpeta, "assets"));
  writeFileSync(path.join(carpeta, "index.html"), "<!doctype html><title>Comandas</title>");
  writeFileSync(path.join(carpeta, "sw.js"), "// service worker");
  writeFileSync(path.join(carpeta, "assets", "index-abc123.js"), "console.log(1)");
  const servidor = express();
  servidor.get("/api/salud", (_req, res) => void res.json({ ok: true }));
  servirFrontend(servidor, carpeta);
  servidor.use(rutaNoEncontrada);

  afterAll(() => rmSync(carpeta, { recursive: true, force: true }));

  it("las rutas de la aplicación responden index.html, sin caché", async () => {
    for (const ruta of ["/", "/login", "/mozo/mesas", "/local/caja", "/admin/ventas", "/mozo/tomar/mesa-123/resumen"]) {
      const res = await request(servidor).get(ruta);
      expect([ruta, res.status, res.headers["cache-control"]]).toEqual([ruta, 200, "no-cache"]);
      expect(res.text).toContain("<title>Comandas</title>");
    }
  });

  it("lo que tiene hash se guarda para siempre; el service worker, nunca", async () => {
    const [conHash, sw] = await Promise.all([request(servidor).get("/assets/index-abc123.js"), request(servidor).get("/sw.js")]);
    expect(conHash.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(sw.headers["cache-control"]).toBe("no-cache");
  });

  it("la API y los archivos que no existen no caen en index.html", async () => {
    const [api, apiFalsa, archivo, post] = await Promise.all([
      request(servidor).get("/api/salud"),
      request(servidor).get("/api/no-existe"),
      request(servidor).get("/assets/no-existe.js"),
      request(servidor).post("/login"),
    ]);
    expect(api.body).toEqual({ ok: true });
    expect([apiFalsa.status, archivo.status, post.status]).toEqual([404, 404, 404]);
    expect(apiFalsa.body.error.codigo).toBe("NO_ENCONTRADO");
  });

  it("sin build del frontend, avisa en vez de arrancar a medias", () => {
    expect(() => servirFrontend(express(), path.join(carpeta, "no-existe"))).toThrow(/No está el build del frontend/);
  });
});

describe("seed de producción", () => {
  const ADMIN = { ADMIN_INICIAL_NOMBRE: "Colver Falcón", ADMIN_INICIAL_USUARIO: "Colver", ADMIN_INICIAL_PASSWORD: "una-clave-larga" };
  const contar = async () => ({
    negocios: await prisma.negocio.count(),
    usuarios: await prisma.usuario.count(),
    areas: await prisma.area.count(),
    categorias: await prisma.categoria.count(),
    productos: await prisma.producto.count(),
    variantes: await prisma.varianteProducto.count(),
    opciones: await prisma.comboOpcion.count(),
    mesas: await prisma.mesa.count(),
    notas: await prisma.notaRapida.count(),
    repartidores: await prisma.repartidor.count(),
  });

  it("en una base vacía crea el negocio completo y un solo usuario, dueño y cocina", async () => {
    const { hecho } = await sembrarProduccion(ADMIN);
    const negocio = await prisma.negocio.findUniqueOrThrow({ where: { codigo: "valentina" } });
    const usuarios = await prisma.usuario.findMany();
    const entrar = await request(app).post("/api/auth/login").send({ codigoNegocio: "valentina", usuario: "colver", password: "una-clave-larga" });
    const logo = await request(app).get(negocio.logoUrl!);

    expect(hecho).toHaveLength(6);
    expect(await contar()).toEqual({ negocios: 1, usuarios: 1, areas: 2, categorias: 7, productos: 34, variantes: 35, opciones: 12, mesas: 7, notas: 6, repartidores: 1 });
    expect(negocio).toMatchObject({ nombre: "Cevichería Valentina", distritos: ["Tarapoto", "Morales", "La Banda de Shilcayo"], logoTipo: "image/png" });
    expect(usuarios).toMatchObject([{ nombre: "Colver Falcón", usuario: "colver", roles: ["ADMIN", "LOCAL"], activo: true }]);
    expect(usuarios[0].passwordHash).not.toContain("una-clave-larga");
    expect(await prisma.repartidor.findFirstOrThrow()).toMatchObject({ nombre: "José Falcón", telefono: "916386642" });
    expect(entrar.status).toBe(200);
    expect(logo.status).toBe(200);
    expect(logo.headers["content-type"]).toBe("image/png");
    expect(logo.body.length).toBeGreaterThan(10_000);
  });

  it("correrlo otra vez no duplica ni cambia nada, aunque cambien las variables", async () => {
    await sembrarProduccion(ADMIN);
    const antes = await contar();
    // El dueño ya trabajó: cambió un precio, apagó una mesa y quitó una nota
    const ceviche = await prisma.varianteProducto.findFirstOrThrow({ where: { producto: { nombre: "Ceviche Simple" } } });
    await prisma.varianteProducto.update({ where: { id: ceviche.id }, data: { precio: 23 } });
    await prisma.mesa.updateMany({ where: { nombre: "Mesa 7" }, data: { activo: false } });
    await prisma.notaRapida.deleteMany({ where: { texto: "Sin culantro" } });
    const hash = (await prisma.usuario.findFirstOrThrow()).passwordHash;

    const segunda = await sembrarProduccion({ ADMIN_INICIAL_NOMBRE: "Otro", ADMIN_INICIAL_USUARIO: "otro", ADMIN_INICIAL_PASSWORD: "otra-clave-larga" });
    // Y sin las variables del usuario tampoco hace falta nada: ya hay usuarios
    const tercera = await sembrarProduccion({});

    expect(segunda.hecho).toEqual([]);
    expect(tercera.hecho).toEqual([]);
    expect(await contar()).toEqual({ ...antes, notas: 5 });
    expect((await prisma.varianteProducto.findUniqueOrThrow({ where: { id: ceviche.id } })).precio.toFixed(2)).toBe("23.00");
    expect((await prisma.mesa.findFirstOrThrow({ where: { nombre: "Mesa 7" } })).activo).toBe(false);
    expect(await prisma.usuario.findFirstOrThrow()).toMatchObject({ usuario: "colver", passwordHash: hash });
  });

  it("completa solo lo que falta, sin tocar lo que hay ni a otros negocios", async () => {
    const otro = await crearNegocio("Negocio B", "negocio-b");
    await sembrarProduccion(ADMIN);
    const negocio = await prisma.negocio.findUniqueOrThrow({ where: { codigo: "valentina" }, select: { id: true } });
    // Se pierden las mesas y el motorizado (una base restaurada a medias, por ejemplo)
    await prisma.mesa.deleteMany({ where: { negocioId: negocio.id } });
    await prisma.repartidor.deleteMany({ where: { negocioId: negocio.id } });
    await prisma.negocio.update({ where: { id: negocio.id }, data: { logo: null, logoTipo: null, logoUrl: null } });
    const productosAntes = await prisma.producto.count({ where: { negocioId: negocio.id } });

    const { hecho } = await sembrarProduccion({});

    expect(hecho).toEqual(["el logo", "las mesas", "el motorizado José Falcón"]);
    expect(await prisma.mesa.count({ where: { negocioId: negocio.id } })).toBe(7);
    expect(await prisma.producto.count({ where: { negocioId: negocio.id } })).toBe(productosAntes);
    expect(await prisma.area.count({ where: { negocioId: negocio.id } })).toBe(2);
    expect(await prisma.mesa.count({ where: { negocioId: otro.negocio.id } })).toBe(3);
    expect(await prisma.usuario.count({ where: { negocioId: otro.negocio.id } })).toBe(3);
  });

  it("sin los datos del primer usuario no crea nada y dice qué falta", async () => {
    await expect(sembrarProduccion({ ADMIN_INICIAL_USUARIO: "con espacio", ADMIN_INICIAL_PASSWORD: "corta" })).rejects.toThrow(
      /ADMIN_INICIAL_NOMBRE: falta[\s\S]*ADMIN_INICIAL_USUARIO[\s\S]*ADMIN_INICIAL_PASSWORD: necesita al menos 8/,
    );
    expect(await prisma.negocio.count()).toBe(0);
  });
});
