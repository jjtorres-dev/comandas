import { expect, test } from "@playwright/test";
import { boton, con, entrarComoMozo, limpiarActivos, type Mesa, mesasLibres, pedidoDeMesa, tokenDe } from "./ayudas";

// Las bebidas no pasan por cocina (el mozo las saca de la refrigeradora): se
// piden de a 6 con el teclado, la cocina solo ve el ceviche, la mesa muestra
// todo sumado, el mozo corrige de a una unidad y la caja cobra sin esperar a
// que la cocina marque nada.

let mesa: Mesa;

test.beforeAll(async ({ request }) => {
  [mesa] = await mesasLibres(request, 1);
});

test.afterAll(async ({ request }) => {
  await limpiarActivos(request);
  const token = con(await tokenDe(request, "cocina", "cocina123"));
  // La caja queda cerrada para la siguiente corrida
  const { turno } = await (await request.get("/api/caja/actual", token)).json();
  if (turno) await request.post("/api/caja/cerrar", { ...token, data: { efectivoContado: 0 } });
});

test("6 cervezas con el teclado y un ceviche: cocina solo ve el ceviche, la mesa suma y la caja cobra", async ({ browser, page: mozo, request }, info) => {
  // Las capturas esperan a que terminen la hoja y los avisos de moverse
  const captura = async (nombre: string) => {
    await mozo.waitForTimeout(450);
    await mozo.screenshot({ path: info.outputPath("capturas", `${nombre}.png`) });
  };
  const tokenCocina = await tokenDe(request, "cocina", "cocina123");
  const itemsDeLaMesa = async () =>
    ((await pedidoDeMesa(request, tokenCocina, mesa.id))?.items ?? []).map((i) => `${i.cantidad} ${i.nombreProducto}: ${i.estado}`);

  // El monitor del local: primero la cocina, al final la caja
  const contextoLocal = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "es-PE" });
  const local = await contextoLocal.newPage();
  await local.addInitScript(() => {
    localStorage.setItem("comandas.negocio", "valentina");
    // Cada tono del aviso es un oscilador: se cuentan para saber si sonó
    const w = window as unknown as { tonos: number };
    w.tonos = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      w.tonos += 1;
      return original.call(this);
    };
  });
  const avisos = async () => (await local.evaluate(() => (window as unknown as { tonos: number }).tonos)) / 3;
  await local.goto("/login");
  await local.getByLabel("Usuario").fill("cocina");
  await local.getByRole("textbox", { name: "Contraseña" }).fill("cocina123");
  await boton(local, "Entrar").click();
  await boton(local, "Abrir cocina").click();
  expect(await avisos()).toBe(1); // el aviso de muestra
  const tarjeta = local.getByRole("article", { name: new RegExp(`${mesa.nombre}$`) });

  await entrarComoMozo(mozo);
  const baldosa = mozo.getByRole("link", { name: new RegExp(`^${mesa.nombre}\\b`) });

  await test.step("el mozo pide 6 cervezas con el teclado numérico y un ceviche", async () => {
    await baldosa.click();
    await boton(mozo, "Bebidas").click();
    // Un toque suma 1 y aparece "− cantidad +"
    await boton(mozo, /^Cerveza Pilsen/).click();
    await expect(boton(mozo, "Quitar 1 Cerveza Pilsen")).toBeVisible();
    await expect(boton(mozo, "Uno más de Cerveza Pilsen")).toBeVisible();
    await captura("1-carta-con-cantidad");

    // Tocar la cantidad abre el teclado; el atajo 6 la pone de un toque
    await boton(mozo, /^Cantidad de Cerveza Pilsen: 1/).click();
    const teclado = mozo.getByRole("dialog", { name: "Cerveza Pilsen" });
    await expect(teclado.getByRole("group", { name: "Teclado numérico" })).toBeVisible();
    for (const atajo of [2, 3, 4, 6, 12]) await expect(teclado.getByRole("button", { name: `Poner ${atajo}`, exact: true })).toBeVisible();
    await captura("2-teclado-de-cantidad");
    await teclado.getByRole("button", { name: "Poner 6", exact: true }).click();
    await expect(teclado).toBeHidden();
    await expect(boton(mozo, /^Cantidad de Cerveza Pilsen: 6/)).toBeVisible();

    // Las cervezas se cuentan como bebidas, no como platos
    await expect(mozo.getByRole("link", { name: /Ver pedido/ })).toContainText("6 bebidas");
    await expect(mozo.getByRole("link", { name: /Ver pedido/ })).not.toContainText("plato");

    // Solo bebidas: no hay nada que enviarle a la cocina, se anota en la cuenta
    await mozo.getByRole("link", { name: /Ver pedido/ }).click();
    await expect(mozo.getByText("Total · 6 bebidas")).toBeVisible();
    await expect(boton(mozo, "Anotar en la cuenta")).toBeVisible();
    await expect(boton(mozo, "Enviar a cocina")).toBeHidden();
    await mozo.getByRole("link", { name: "Volver a la carta" }).click();

    // Con un plato de cocina el pedido es mixto: vuelve a ser "Enviar a cocina"
    await mozo.getByRole("navigation", { name: "Categorías" }).getByRole("button").first().click();
    await boton(mozo, /^Ceviche Simple/).click();
    await expect(mozo.getByRole("link", { name: /Ver pedido/ })).toContainText("S/ 74.00");
    // Mixto: los platos primero
    await expect(mozo.getByRole("link", { name: /Ver pedido/ })).toContainText("1 plato · 6 bebidas");
    await mozo.getByRole("link", { name: /Ver pedido/ }).click();
    await expect(mozo.getByText("Total · 1 plato · 6 bebidas")).toBeVisible();

    // En el resumen la cantidad también se escribe: 12 con el teclado, y de vuelta a 6
    await boton(mozo, /^Cantidad de Cerveza Pilsen: 6/).click();
    await teclado.getByRole("button", { name: "1", exact: true }).click();
    await teclado.getByRole("button", { name: "2", exact: true }).click();
    await teclado.getByRole("button", { name: "Poner 12", exact: true }).last().click();
    await expect(mozo.getByText("S/ 128.00")).toBeVisible();
    await boton(mozo, /^Cantidad de Cerveza Pilsen: 12/).click();
    await teclado.getByRole("button", { name: "Poner 6", exact: true }).click();
    await expect(teclado).toBeHidden();
    await expect(mozo.getByText("S/ 74.00")).toBeVisible();
    await captura("3-resumen");

    await boton(mozo, "Enviar a cocina").click();
    await expect(mozo).toHaveURL(/\/mozo\/mesas/);
    await expect(baldosa).toContainText("S/ 74.00");
  });

  await test.step("cocina solo ve el ceviche: las cervezas ni aparecen ni cuentan", async () => {
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toContainText("Ceviche Simple");
    await expect(tarjeta).not.toContainText("Cerveza");
    await expect(tarjeta.getByRole("heading", { name: "Bebidas" })).toBeHidden();
    await expect.poll(avisos).toBe(2);
    // Nacieron entregadas; el ceviche espera a la cocina
    expect(await itemsDeLaMesa()).toEqual(["6 Cerveza Pilsen: ENTREGADO", "1 Ceviche Simple: PENDIENTE"]);
  });

  const cuenta = mozo.getByRole("list", { name: "Todo lo pedido" });
  const cervezas = cuenta.getByRole("listitem").filter({ hasText: "Cerveza Pilsen" });
  const total = mozo.getByRole("region", { name: "Cuenta de la mesa" });

  await test.step("la mesa muestra todo sumado, con el total grande", async () => {
    await baldosa.click();
    await expect(total).toContainText("S/ 74.00");
    await expect(cervezas).toContainText("6×");
    await expect(cervezas).toContainText("S/ 54.00");
    await expect(cuenta.getByRole("listitem").filter({ hasText: "Ceviche Simple" })).toContainText("1 pendiente");
    await captura("4-cuenta-de-la-mesa");
  });

  await test.step("agrega 2 cervezas más: entran directo, la cocina no se entera", async () => {
    await boton(mozo, "Uno más de Cerveza Pilsen").click();
    await boton(mozo, "Uno más de Cerveza Pilsen").click();
    await expect(cervezas).toContainText("+2 enviando");
    await expect(cervezas).toContainText("8×");
    await expect(total).toContainText("S/ 92.00");
    // Los dos toques llegaron como una sola ronda
    expect(await itemsDeLaMesa()).toEqual(["6 Cerveza Pilsen: ENTREGADO", "1 Ceviche Simple: PENDIENTE", "2 Cerveza Pilsen: ENTREGADO"]);
    await expect(tarjeta).not.toContainText("Ronda 2");
    expect(await avisos()).toBe(2);
  });

  await test.step("quita 1: pide confirmar, y queda registrado quién la quitó", async () => {
    await boton(mozo, "Quitar 1 Cerveza Pilsen").click();
    await captura("5-confirmar-quitar");
    await boton(mozo, "Sí, quitar 1").click();
    await expect(cervezas).toContainText("7×");
    await expect(cervezas).toContainText("S/ 63.00");
    await expect(total).toContainText("S/ 83.00");

    const admin = con(await tokenDe(request, "admin", "admin123"));
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date());
    const reporte = await (await request.get(`/api/admin/reportes?desde=${hoy}&hasta=${hoy}`, admin)).json();
    expect(reporte.cancelaciones[0]).toMatchObject({ nombreProducto: "Cerveza Pilsen", cantidad: 1, monto: "9.00", usuario: "Mozo", yaEntregado: true });
  });

  await test.step("lo que la cocina ya empezó no se quita desde el salón", async () => {
    await tarjeta.getByRole("button", { name: "Empezar" }).first().click();
    await expect(cuenta.getByRole("listitem").filter({ hasText: "Ceviche Simple" })).toContainText("1 preparando");
    await boton(mozo, "Quitar 1 Ceviche Simple").click();
    await expect(mozo.getByText("Ya se está preparando: pídelo a cocina")).toBeVisible();
    await expect(boton(mozo, "Sí, quitar 1")).toBeHidden();

    // Por rondas sigue ahí, como vista secundaria
    await boton(mozo, "Por rondas").click();
    await expect(mozo.getByRole("heading", { name: "Ronda 2" })).toBeVisible();
    await captura("6-por-rondas");
    await boton(mozo, "Todo junto").click();
  });

  await test.step("la caja cobra los S/ 83 sin que la cocina marque nada listo", async () => {
    await request.post("/api/caja/abrir", { ...con(tokenCocina), data: { montoInicial: 0 } });
    await local.getByRole("link", { name: "Caja" }).click();
    const porCobrar = local.getByRole("navigation", { name: "Por cobrar" }).getByRole("button", { name: new RegExp(mesa.nombre) });
    await expect(porCobrar).toContainText("1 plato · 7 bebidas");
    await porCobrar.click();
    const cobro = local.getByRole("region", { name: "Cobro" });
    await expect(local.getByRole("region", { name: "Cuenta" })).toContainText("Cerveza Pilsen");
    await cobro.getByRole("button", { name: "Yape" }).click();
    await cobro.getByRole("button", { name: "2. Cobrar S/ 83.00" }).click();
    await expect(cobro).toContainText("Cobrado S/ 83.00");

    // El ceviche seguía en preparación: cobrar no esperó a la cocina, y la mesa quedó libre
    const { pedidos } = await (await request.get("/api/pedidos/activos", con(tokenCocina))).json();
    const cobrado = pedidos.find((p: { mesa: { id: string } | null }) => p.mesa?.id === mesa.id);
    expect(cobrado).toMatchObject({ pagado: true, estado: "PREPARANDO", total: "83.00" });
    await mozo.goto("/mozo/mesas");
    await expect(baldosa).toContainText("Libre");
  });

  await contextoLocal.close();
});

test("el dueño decide qué pasa por cocina y ve en Ventas lo que se quitó de los pedidos", async ({ page, request }, info) => {
  const captura = async (nombre: string) => {
    await page.waitForTimeout(450);
    await page.screenshot({ path: info.outputPath("capturas", `${nombre}.png`), fullPage: true });
  };
  const areas = async () => {
    const carta = await (await request.get("/api/carta", con(await tokenDe(request, "mozo", "mozo123")))).json();
    return Object.fromEntries(carta.areas.map((a: { nombre: string; pasaPorCocina: boolean }) => [a.nombre, a.pasaPorCocina]));
  };

  await page.addInitScript(() => localStorage.setItem("comandas.negocio", "valentina"));
  await page.goto("/login");
  await page.getByLabel("Usuario").fill("admin");
  await page.getByRole("textbox", { name: "Contraseña" }).fill("admin123");
  await boton(page, "Entrar").click();

  await test.step("Local: un interruptor por área; las bebidas vienen sin pasar por cocina", async () => {
    await page.getByRole("link", { name: "Local" }).click();
    const lista = page.getByRole("list", { name: "Áreas de preparación" });
    const bebidas = lista.getByRole("switch", { name: "Bebidas" });
    await expect(lista.getByRole("switch", { name: "Cocina" })).toBeChecked();
    await expect(bebidas).not.toBeChecked();
    await lista.scrollIntoViewIfNeeded();
    await captura("7-admin-que-pasa-por-cocina");

    await bebidas.click();
    await expect(bebidas).toBeChecked();
    expect(await areas()).toEqual({ Cocina: true, Bebidas: true });
    await bebidas.click();
    await expect(bebidas).not.toBeChecked();
    expect(await areas()).toEqual({ Cocina: true, Bebidas: false });
  });

  await test.step("Ventas: la cerveza que quitó el mozo, con su nombre y que ya estaba en la mesa", async () => {
    await page.getByRole("link", { name: "Ventas" }).click();
    const quitados = page.getByRole("list", { name: "Platos y bebidas quitados" });
    await expect(quitados).toContainText(`Quitó 1 Cerveza Pilsen (S/ 9.00) de ${mesa.nombre}`);
    await expect(quitados).toContainText("Ya estaba en la mesa cuando se quitó.");
    await expect(quitados).toContainText("Mozo ·");
    await quitados.scrollIntoViewIfNeeded();
    await captura("8-admin-quitados");
  });
});
