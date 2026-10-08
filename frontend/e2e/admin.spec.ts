import { type APIRequestContext, type Browser, expect, type Page, test } from "@playwright/test";
import { boton, con, entrarComoMozo, limpiarActivos, mesasLibres, tokenDe } from "./ayudas";

// La administración del dueño: cambia un precio desde la lista y el mozo lo ve
// sin recargar (los pedidos de antes no cambian), crea a un mozo que entra con
// su usuario, pasa de la cocina a la administración y vuelve sin cerrar sesión,
// y ve en Ventas el pedido que se cobró.

const PLATO = "Sudado de Filete";
type Variante = { id: string; precio: string };
type Producto = { id: string; nombre: string; variantes: Variante[] };

async function platoDeLaCarta(api: APIRequestContext, token: string, nombre: string): Promise<Producto> {
  const carta = await (await api.get("/api/carta", con(token))).json();
  return carta.categorias.flatMap((c: { productos: Producto[] }) => c.productos).find((p: Producto) => p.nombre === nombre);
}

async function entrar(browser: Browser, usuario: string, password: string, viewport = { width: 1920, height: 1080 }): Promise<Page> {
  const contexto = await browser.newContext({ viewport, locale: "es-PE" });
  const page = await contexto.newPage();
  await page.addInitScript(() => localStorage.setItem("comandas.negocio", "valentina"));
  await page.goto("/login");
  await page.getByLabel("Usuario").fill(usuario);
  await page.getByRole("textbox", { name: "Contraseña" }).fill(password);
  await boton(page, "Entrar").click();
  return page;
}

let precioOriginal: string;
let varianteId: string;

test.beforeAll(async ({ request }) => {
  const plato = await platoDeLaCarta(request, await tokenDe(request, "admin", "admin123"), PLATO);
  [{ id: varianteId, precio: precioOriginal }] = plato.variantes;
});

// La carta y los pedidos quedan como estaban para las demás pruebas
test.afterAll(async ({ request }) => {
  const admin = con(await tokenDe(request, "admin", "admin123"));
  await request.patch(`/api/admin/variantes/${varianteId}/precio`, { ...admin, data: { precio: Number(precioOriginal) } });
  await limpiarActivos(request);
  await request.post("/api/caja/cerrar", { ...admin, data: { efectivoContado: 0 } });
});

test("el dueño cambia un precio desde la lista: el mozo lo ve sin recargar y lo ya pedido no cambia", async ({ browser, page, request }) => {
  const tokenMozo = await tokenDe(request, "mozo", "mozo123");
  const tokenAdmin = await tokenDe(request, "admin", "admin123");
  const [mesaPedido, mesaLibre] = await mesasLibres(request, 2);

  // Un pedido tomado antes del cambio de precio
  const antes = await request.post("/api/pedidos", {
    ...con(tokenMozo),
    data: { tipo: "MESA", mesaId: mesaPedido.id, idCliente: crypto.randomUUID(), items: [{ varianteId, cantidad: 2, notas: [] }] },
  });
  expect(antes.status()).toBe(201);
  const pedido = (await antes.json()).pedido as { id: string; total: string };
  expect(pedido.total).toBe("40.00");

  // El mozo está tomando un pedido en otra mesa, con la carta a la vista
  await entrarComoMozo(page);
  await page.getByRole("link", { name: new RegExp(`^${mesaLibre.nombre}\\b`) }).click();
  await expect(boton(page, new RegExp(`^${PLATO} S/ 20\\.00`))).toBeVisible();

  // El dueño solo tiene el puesto de dueño: entra directo a la administración
  const dueno = await entrar(browser, "admin", "admin123", { width: 412, height: 915 });
  await expect(dueno).toHaveURL(/\/admin\/ventas/);
  await dueno.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Carta" }).click();

  await test.step("cada categoría tiene su botón de plato nuevo", async () => {
    await expect(boton(dueno, "Nuevo plato en Sudados")).toBeVisible();
    const cuantas = await dueno.getByRole("heading", { level: 2 }).count();
    expect(cuantas).toBeGreaterThan(3);
    await expect(dueno.getByRole("button", { name: /^Nuevo plato en / })).toHaveCount(cuantas);
  });

  await test.step("toca el precio en la lista, escribe el nuevo y guarda con Enter", async () => {
    await boton(dueno, `Cambiar precio de ${PLATO}: S/ 20.00`).click();
    // No se abrió ninguna ficha: el precio se edita ahí mismo
    await expect(dueno.getByRole("dialog")).toHaveCount(0);
    const campo = dueno.getByRole("textbox", { name: `Precio nuevo de ${PLATO}, en soles` });
    await expect(campo).toBeFocused();
    await campo.fill("21.5");
    await campo.press("Enter");
    await expect(boton(dueno, `Cambiar precio de ${PLATO}: S/ 21.50`)).toBeVisible();
  });

  await test.step("el mozo ve el precio nuevo sin recargar", async () => {
    await expect(boton(page, new RegExp(`^${PLATO} S/ 21\\.50`))).toBeVisible();
  });

  await test.step("cada precio de un plato con variantes se cambia por separado, con el botón Guardar", async () => {
    await boton(dueno, "Cambiar precio de Chicharrón de Pota, S/ 18: S/ 18.00").click();
    await dueno.getByRole("textbox", { name: /Precio nuevo de Chicharrón de Pota, S\/ 18/ }).fill("19");
    await boton(dueno, "Guardar").click();
    await expect(boton(dueno, "Cambiar precio de Chicharrón de Pota, S/ 18: S/ 19.00")).toBeVisible();
    await expect(boton(dueno, "Cambiar precio de Chicharrón de Pota, S/ 10: S/ 10.00")).toBeVisible();
    // Se deja como estaba: otras pruebas cuentan con S/ 18
    await boton(dueno, "Cambiar precio de Chicharrón de Pota, S/ 18: S/ 19.00").click();
    await dueno.getByRole("textbox", { name: /Precio nuevo de Chicharrón de Pota, S\/ 18/ }).fill("18");
    await boton(dueno, "Guardar").click();
    await expect(boton(dueno, "Cambiar precio de Chicharrón de Pota, S/ 18: S/ 18.00")).toBeVisible();
  });

  await test.step("el pedido de antes conserva su precio; uno nuevo usa el nuevo", async () => {
    const cuenta = (await (await request.get(`/api/pedidos/${pedido.id}/cuenta`, con(tokenMozo))).json()).cuenta;
    expect(cuenta.total).toBe("40.00");
    expect(cuenta.items[0].precioUnitario).toBe("20.00");

    const nuevo = await request.post("/api/pedidos", {
      ...con(tokenMozo),
      data: { tipo: "PARA_LLEVAR", idCliente: crypto.randomUUID(), cliente: { nombre: "Precio nuevo" }, items: [{ varianteId, cantidad: 1, notas: [] }] },
    });
    expect((await nuevo.json()).pedido.items[0].precioUnitario).toBe("21.50");
  });

  await test.step("el dueño ve en Ventas el pedido cobrado hoy", async () => {
    // La caja cobra el pedido de la mesa: 40 en Yape
    await request.post("/api/caja/abrir", { ...con(tokenAdmin), data: { montoInicial: 0 } });
    const cobro = await request.post(`/api/pedidos/${pedido.id}/pagos`, { ...con(tokenAdmin), data: { pagos: [{ metodo: "YAPE", monto: 40 }] } });
    expect(cobro.status()).toBe(201);
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
    const reporte = await (await request.get(`/api/admin/reportes?desde=${hoy}&hasta=${hoy}`, con(tokenAdmin))).json();
    const soles = (monto: string) => `S/ ${Number(monto).toFixed(2)}`;

    await dueno.getByRole("navigation", { name: "Secciones" }).getByRole("link", { name: "Ventas" }).click();
    const resumen = dueno.getByRole("region", { name: "Resumen" });
    // Llega solo: el cobro avisa por tiempo real
    await expect(resumen).toContainText(`Cobrado hoy${soles(reporte.ventas.total)}`);
    expect(Number(reporte.ventas.total)).toBeGreaterThanOrEqual(40);
    await expect(resumen.getByText("Pedidos cobrados").locator("..")).toContainText(String(reporte.ventas.pedidos));
    // El para llevar con el precio nuevo todavía no se cobró
    await expect(resumen.getByText("Por cobrar").locator("..")).toContainText(soles(reporte.porCobrar.total));
    expect(Number(reporte.porCobrar.total)).toBeGreaterThanOrEqual(21.5);

    await expect(dueno.getByRole("list", { name: "Cobrado por forma de pago" }).getByRole("listitem").filter({ hasText: "Yape" })).toContainText(soles(reporte.ventas.porMetodo.YAPE));
    await expect(dueno.getByRole("list", { name: "Platos más pedidos" }).getByRole("listitem").filter({ hasText: PLATO })).toContainText("3");
    await expect(dueno.getByRole("heading", { name: "Turnos de caja" }).locator("..")).toContainText("Sigue abierto");
    // Un solo día: no hay gráfico por día, pero sí por hora, y se puede leer en tabla
    await expect(dueno.getByRole("heading", { name: "Cobrado por día" })).toHaveCount(0);
    await dueno.getByText("Ver en tabla").click();
    await expect(dueno.getByRole("table")).toContainText(/\d pedidos?/);

    // La semana sí trae el gráfico por día
    await boton(dueno, "Semana").click();
    await expect(resumen).toContainText(/Cobrado (hoy|del )/);
  });

  await dueno.context().close();
});

test("el dueño crea a un mozo, que entra con su usuario", async ({ browser }) => {
  const dueno = await entrar(browser, "admin", "admin123");
  await dueno.getByRole("link", { name: "Personal" }).click();
  await boton(dueno, "Nueva persona").click();

  const ficha = dueno.getByRole("dialog", { name: "Nueva persona" });
  await ficha.getByLabel("Nombre").fill("Soger");
  // El usuario se escribe solo en minúsculas y sin espacios
  await ficha.getByLabel("Usuario").fill("So ger");
  await expect(ficha.getByLabel("Usuario")).toHaveValue("soger");
  // Viene marcado Mozo; sin contraseña no deja crear
  await expect(ficha.getByRole("checkbox", { name: /^Mozo/ })).toBeChecked();
  await expect(boton(ficha, "Crear usuario")).toBeDisabled();
  await expect(ficha.getByText("La contraseña necesita al menos 6 caracteres")).toBeVisible();
  await ficha.getByRole("textbox", { name: "Contraseña" }).fill("soger123");
  await boton(ficha, "Crear usuario").click();

  await expect(ficha).toBeHidden();
  await expect(boton(dueno, "Editar a Soger")).toContainText("Mozo · usuario soger");

  // Un usuario repetido no pasa, y la ficha no se cierra
  await boton(dueno, "Nueva persona").click();
  await ficha.getByLabel("Nombre").fill("Otro");
  await ficha.getByLabel("Usuario").fill("soger");
  await ficha.getByRole("textbox", { name: "Contraseña" }).fill("otro1234");
  await boton(ficha, "Crear usuario").click();
  await expect(dueno.getByText(/Ya hay alguien con el usuario "soger"/)).toBeVisible();
  await expect(ficha).toBeVisible();
  await dueno.context().close();

  const mozo = await entrar(browser, "soger", "soger123", { width: 412, height: 915 });
  await expect(mozo).toHaveURL(/\/mozo\/mesas/);
  // Un mozo no entra a la administración: vuelve a lo suyo
  await mozo.goto("/admin/carta");
  await expect(mozo).toHaveURL(/\/mozo\/mesas/);
  await mozo.context().close();
});

test("quien es dueño y cocina pasa de la cocina a la administración y vuelve sin cerrar sesión", async ({ browser, request }) => {
  const admin = con(await tokenDe(request, "admin", "admin123"));
  const creado = await request.post("/api/admin/usuarios", { ...admin, data: { nombre: "Colver Falcón", usuario: "colver", password: "colver123", roles: ["ADMIN", "LOCAL"] } });
  expect(creado.status()).toBe(201);

  const page = await entrar(browser, "colver", "colver123");
  // Lo suyo en hora punta es la cocina: entra ahí
  await expect(page).toHaveURL(/\/local\/cocina/);
  await boton(page, "Abrir cocina").click();

  await page.getByRole("link", { name: "Administración" }).click();
  await expect(page).toHaveURL(/\/admin\/ventas/);
  await expect(page.getByRole("region", { name: "Resumen" })).toContainText("Cobrado hoy");

  await page.getByRole("link", { name: "Local", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mesas" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Motorizados" })).toContainText("José Falcón");

  await page.getByRole("link", { name: "Cocina y caja" }).click();
  await expect(page).toHaveURL(/\/local\/cocina/);
  // Sigue con su sesión y con la cocina abierta: no vuelve a pedir el botón
  await expect(boton(page, "Abrir cocina")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Caja" })).toBeVisible();

  // Quien solo cocina no ve el acceso a la administración
  const cocina = await entrar(browser, "cocina", "cocina123");
  await expect(cocina).toHaveURL(/\/local\/cocina/);
  await expect(cocina.getByRole("link", { name: "Administración" })).toHaveCount(0);
  await cocina.goto("/admin");
  await expect(cocina).toHaveURL(/\/local\/cocina/);

  await page.context().close();
  await cocina.context().close();
});
