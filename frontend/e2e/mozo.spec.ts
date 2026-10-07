import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

// Recorrido completo del mozo sobre una mesa libre: pedido con variante,
// combo y notas, una ronda enviada sin red (la cola la reintenta sola) y el
// aviso de LISTO cuando cocina marca el pedido por la API.

type Item = { id: string; estado: string; nombreProducto: string; cantidad: number; notas: string[]; componentes: string[]; idRonda: string };
type Pedido = { id: string; total: string; nota: string | null; mesa: { id: string } | null; items: Item[] };

async function tokenDe(api: APIRequestContext, usuario: string, password: string): Promise<string> {
  const respuesta = await api.post("/api/auth/login", { data: { codigoNegocio: "valentina", usuario, password } });
  expect(respuesta.ok(), `login de ${usuario}`).toBeTruthy();
  return (await respuesta.json()).token;
}

const con = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

async function pedidoDeMesa(api: APIRequestContext, token: string, mesaId: string): Promise<Pedido | undefined> {
  const { pedidos } = (await (await api.get("/api/pedidos/activos", con(token))).json()) as { pedidos: Pedido[] };
  return pedidos.find((p) => p.mesa?.id === mesaId);
}

const boton = (page: Page, nombre: string | RegExp) => page.getByRole("button", { name: nombre });

let mesa: { id: string; nombre: string };

test.beforeAll(async ({ request }) => {
  const token = await tokenDe(request, "mozo", "mozo123");
  const { mesas } = await (await request.get("/api/mesas", con(token))).json();
  const libre = mesas.find((m: { estado: string }) => m.estado === "libre");
  expect(libre, "Hace falta una mesa libre. Cobra o cancela un pedido, o corre `npm run db:seed` en backend/").toBeTruthy();
  mesa = libre;
});

// La mesa queda libre para la siguiente corrida: el dueño cancela lo pedido
test.afterAll(async ({ request }) => {
  if (!mesa) return;
  const token = await tokenDe(request, "admin", "admin123");
  const pedido = await pedidoDeMesa(request, token, mesa.id);
  for (const item of pedido?.items ?? []) {
    if (item.estado !== "CANCELADO") await request.patch(`/api/pedidos/${pedido!.id}/items/${item.id}/cancelar`, con(token));
  }
});

test("el mozo toma un pedido, agrega una ronda sin red y recibe el aviso de listo", async ({ page, context, request }) => {
  // El negocio ya está recordado en el equipo, y la vibración se registra para comprobarla
  await page.addInitScript(() => {
    localStorage.setItem("comandas.negocio", "valentina");
    Object.defineProperty(Navigator.prototype, "vibrate", {
      configurable: true,
      value: (patron: unknown) => {
        const w = window as unknown as { vibraciones?: unknown[] };
        (w.vibraciones ??= []).push(patron);
        return true;
      },
    });
  });

  await test.step("entra como mozo", async () => {
    await page.goto("/login");
    await page.getByLabel("Usuario").fill("mozo");
    await page.getByRole("textbox", { name: "Contraseña" }).fill("mozo123");
    await boton(page, "Entrar").click();
    await expect(page).toHaveURL(/\/mozo\/mesas/);
  });

  const baldosa = page.getByRole("link", { name: new RegExp(`^${mesa.nombre}\\b`) });

  await test.step("toma el pedido: plato, variante y combo", async () => {
    await expect(baldosa).toContainText("Libre");
    await baldosa.click();
    await expect(page.getByRole("heading", { name: mesa.nombre })).toBeVisible();

    // Un toque = 1 unidad
    await boton(page, /^Ceviche Simple/).click();
    await boton(page, /^Ceviche Simple/).click();
    await expect(boton(page, /^Ceviche Simple/)).toContainText("2");

    // Varias variantes: hoja inferior para elegir
    await boton(page, "Frituras").click();
    await boton(page, /^Chicharrón de Pota/).click();
    const hojaVariantes = page.getByRole("dialog", { name: "Chicharrón de Pota" });
    await hojaVariantes.getByRole("button", { name: /18\.00/ }).click();
    await expect(hojaVariantes).toBeHidden();

    // Combo: exactamente 3 platos, se puede repetir
    await boton(page, "Combos").click();
    await boton(page, /^Combo Triple/).click();
    const hojaCombo = page.getByRole("dialog", { name: "Combo Triple" });
    await expect(hojaCombo.getByRole("button", { name: /Faltan 3/ })).toBeDisabled();
    await hojaCombo.getByRole("button", { name: "Agregar Ceviche Simple" }).click();
    await hojaCombo.getByRole("button", { name: "Agregar Ceviche Simple" }).click();
    await expect(hojaCombo).toContainText("2 de 3");
    await hojaCombo.getByRole("button", { name: "Agregar Arroz con Mariscos" }).click();
    await expect(hojaCombo).toContainText("3 de 3");
    await expect(hojaCombo.getByRole("button", { name: "Agregar Leche de Tigre" })).toBeDisabled();
    await hojaCombo.getByRole("button", { name: "Agregar combo" }).click();

    await expect(page.getByRole("link", { name: /Ver pedido/ })).toContainText("4 platos");
    await expect(page.getByRole("link", { name: /Ver pedido/ })).toContainText("S/ 96.00");
  });

  await test.step("pone una nota solo a 1 de los 2 ceviches y envía", async () => {
    await page.getByRole("link", { name: /Ver pedido/ }).click();
    await boton(page, "Nota").first().click();
    const hojaNotas = page.getByRole("dialog", { name: "Ceviche Simple" });
    await hojaNotas.getByRole("button", { name: "Sin cebolla" }).click();
    await expect(hojaNotas).toContainText("¿Para los 2 o solo para 1?");
    await hojaNotas.getByRole("button", { name: "Solo para 1" }).click();

    // La línea se separó en dos: 1 con la nota y 1 sin ella
    await expect(page.getByRole("main").getByText("Ceviche Simple", { exact: true })).toHaveCount(2);
    await expect(page.getByRole("list", { name: "Notas" })).toHaveCount(1);

    await page.getByLabel("Nota para todo el pedido").fill("Todo junto");
    await boton(page, "Enviar a cocina").click();
    await expect(page).toHaveURL(/\/mozo\/mesas/);
    await expect(baldosa).toContainText("S/ 96.00");
  });

  const tokenMozo = await tokenDe(request, "mozo", "mozo123");

  await test.step("cocina recibió exactamente lo anotado", async () => {
    const pedido = (await pedidoDeMesa(request, tokenMozo, mesa.id))!;
    expect(pedido.nota).toBe("Todo junto");
    expect(pedido.items.map((i) => [i.nombreProducto, i.cantidad, i.notas.join()])).toEqual([
      ["Ceviche Simple", 1, ""],
      ["Ceviche Simple", 1, "Sin cebolla"],
      ["Chicharrón de Pota — S/ 18", 1, ""],
      ["Combo Triple", 1, ""],
    ]);
    expect(pedido.items[3].componentes).toEqual(["Ceviche Simple", "Ceviche Simple", "Arroz con Mariscos"]);
  });

  await test.step("agrega una ronda con la red caída: queda en la cola", async () => {
    await baldosa.click();
    await page.getByRole("link", { name: "Agregar más" }).click();
    await expect(page.getByText("Ronda nueva")).toBeVisible();
    await boton(page, "Bebidas").click();
    await boton(page, /^Gaseosa Personal/).click();
    await page.getByRole("link", { name: /Ver pedido/ }).click();

    await context.setOffline(true);
    await boton(page, "Enviar ronda").click();
    await expect(page).toHaveURL(/\/mozo\/mesas/);
    await expect(boton(page, /1 pedido por enviar/)).toBeVisible();
    await expect(baldosa).toContainText("Ronda esperando conexión");
  });

  await test.step("al cerrar y volver a abrir la app, la cola sigue ahí", async () => {
    // La red vuelve para cargar la app, pero el envío de pedidos sigue fallando
    await page.route("**/api/pedidos/*/items", (ruta) => ruta.abort("internetdisconnected"));
    await context.setOffline(false);
    await page.reload();
    await expect(boton(page, /1 pedido por enviar/)).toBeVisible();
    const pedido = (await pedidoDeMesa(request, tokenMozo, mesa.id))!;
    expect(pedido.items).toHaveLength(4);
  });

  await test.step("cuando vuelve la red, la cola reintenta sola y no duplica", async () => {
    await page.unroute("**/api/pedidos/*/items");
    await expect(boton(page, /pedido por enviar/)).toBeHidden({ timeout: 40_000 });
    await expect(baldosa).toContainText("S/ 99.00");

    const pedido = (await pedidoDeMesa(request, tokenMozo, mesa.id))!;
    expect(pedido.items.filter((i) => i.nombreProducto === "Gaseosa Personal")).toHaveLength(1);
    expect(new Set(pedido.items.map((i) => i.idRonda)).size).toBe(2);
    expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("comandas.mozo.")).map((k) => JSON.parse(localStorage[k]).cola.length))).toEqual([0]);
  });

  await test.step("cocina marca el pedido LISTO por la API: vibra, avisa y destaca", async () => {
    // Un toque cualquiera desbloquea el sonido, como en el celular
    await page.getByRole("link", { name: "Pedidos" }).click();
    await expect(page.getByRole("heading", { name: "Mis pedidos" })).toBeVisible();

    const tokenCocina = await tokenDe(request, "cocina", "cocina123");
    const pedido = (await pedidoDeMesa(request, tokenCocina, mesa.id))!;
    const marcado = await request.patch(`/api/pedidos/${pedido.id}/items/estado`, {
      ...con(tokenCocina),
      data: { itemIds: pedido.items.map((i) => i.id), estado: "LISTO" },
    });
    expect(marcado.ok()).toBeTruthy();

    await expect(page.getByText(`${mesa.nombre}: pedido listo`)).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { vibraciones?: unknown[] }).vibraciones?.length ?? 0)).toBe(1);
    const tarjeta = page.getByRole("article").filter({ hasText: mesa.nombre });
    await expect(tarjeta).toContainText("5 platos listos");
  });

  await test.step("marca Entregado", async () => {
    const tarjeta = page.getByRole("article").filter({ hasText: mesa.nombre });
    await tarjeta.getByRole("button", { name: "Entregado" }).click();
    await expect(tarjeta).toContainText("Entregado");
    await expect(tarjeta.getByRole("button", { name: "Entregado" })).toBeHidden();

    const pedido = (await pedidoDeMesa(request, tokenMozo, mesa.id))!;
    expect(pedido.items.every((i) => i.estado === "ENTREGADO")).toBeTruthy();
  });
});
