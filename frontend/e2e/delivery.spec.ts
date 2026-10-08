import { expect, type Page, test } from "@playwright/test";
import { boton, con, limpiarActivos, tokenDe } from "./ayudas";

// Pedidos por teléfono de punta a punta, en el monitor con teclado: cliente
// nuevo con combo y notas, el cliente vuelve a llamar para agregar una
// gaseosa, cocina lo marca listo, sale, se entrega; un cliente conocido repite
// su pedido; y el motorizado rinde todo de una sola vez.

type Item = { id: string; nombreProducto: string; notas: string[]; idRonda: string; estado: string };
type Pedido = { id: string; numero: number; total: string; pagado: boolean; estado: string; distritoEntrega: string | null; items: Item[] };

test.afterAll(async ({ request }) => {
  await limpiarActivos(request);
});

test("delivery: pedido nuevo, modificación, salida, entrega, repetir pedido y rendición del motorizado", async ({ browser, request }) => {
  const token = con(await tokenDe(request, "cocina", "cocina123"));
  // La caja abierta: sin ella no se puede cobrar lo que rinde el motorizado
  expect((await request.post("/api/caja/abrir", { ...token, data: { montoInicial: 0 } })).status()).toBe(201);
  const porTelefono = async () => ((await (await request.get("/api/pedidos/por-telefono", token)).json()) as { pedidos: Pedido[] }).pedidos;
  const marcarListo = async (pedido: Pedido) =>
    request.patch(`/api/pedidos/${pedido.id}/items/estado`, { ...token, data: { itemIds: pedido.items.filter((i) => i.estado !== "CANCELADO").map((i) => i.id), estado: "LISTO" } });

  const contexto = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "es-PE" });
  const page = await contexto.newPage();
  await page.addInitScript(() => {
    localStorage.setItem("comandas.negocio", "valentina");
    // Las ventanas de WhatsApp no se abren de verdad: se anotan
    const w = window as unknown as { abiertas: string[] };
    w.abiertas = [];
    window.open = (url) => {
      w.abiertas.push(String(url));
      return null;
    };
  });
  await page.goto("/login");
  await page.getByLabel("Usuario").fill("cocina");
  await page.getByRole("textbox", { name: "Contraseña" }).fill("cocina123");
  await boton(page, "Entrar").click();
  await boton(page, "Abrir cocina").click();
  await page.getByRole("link", { name: "Delivery" }).click();

  const columna = (nombre: string) => page.getByRole("region", { name: nombre, exact: true });
  const tarjeta = (numero: number) => page.getByRole("article", { name: new RegExp(`^Pedido ${numero},`) });
  const buscador = page.getByRole("combobox", { name: "Buscar en la carta" });
  const resumen = page.getByRole("region", { name: "Resumen" });
  // Solo las líneas del pedido, sin las notas que cada una lleva dentro
  const anotados = (p: Page) => p.getByRole("list", { name: "Platos anotados" }).locator("> li");

  await test.step("cliente nuevo: teléfono, datos y distrito", async () => {
    await expect(page.getByText("Todavía no hay pedidos por teléfono")).toBeVisible();
    await boton(page, /Nuevo pedido/).click();
    await expect(page.getByLabel("Celular")).toBeFocused();
    await page.getByLabel("Celular").fill("987 111 222");
    await expect(page.getByText("Cliente nuevo")).toBeVisible();
    await page.getByLabel("Nombre").fill("Rosa Pérez");
    await page.getByLabel("Dirección").fill("Jr. San Martín 245");
    await page.getByLabel("Distrito").selectOption("Morales");
    await page.getByLabel("Referencia").fill("Portón verde");
  });

  await test.step("la carta con buscador: \"cevi\" y Enter agrega el primer resultado; el combo usa la hoja del mozo", async () => {
    await buscador.fill("cevi");
    await expect(page.getByRole("list", { name: "Resultados" }).getByRole("button").first()).toContainText("Ceviche Simple");
    await buscador.press("Enter");
    // El buscador queda limpio y con el foco, listo para el siguiente plato
    await expect(buscador).toHaveValue("");
    await expect(buscador).toBeFocused();
    await expect(anotados(page)).toHaveCount(1);

    await buscador.fill("combo");
    await buscador.press("Enter");
    const hojaCombo = page.getByRole("dialog", { name: "Combo Doble" });
    await hojaCombo.getByRole("button", { name: "Agregar Leche de Tigre" }).click();
    await hojaCombo.getByRole("button", { name: "Agregar Chaufa de Mariscos" }).click();
    await hojaCombo.getByRole("button", { name: "Agregar combo" }).click();
    await expect(anotados(page)).toHaveCount(2);

    // Las mismas notas que en la app del mozo
    await anotados(page).filter({ hasText: "Ceviche Simple" }).getByRole("button", { name: "Nota" }).click();
    const hojaNotas = page.getByRole("dialog", { name: "Ceviche Simple" });
    await hojaNotas.getByRole("button", { name: "Sin cebolla" }).click();
    await hojaNotas.getByRole("button", { name: "Guardar nota" }).click();
    await expect(anotados(page).filter({ hasText: "Ceviche Simple" })).toContainText("Sin cebolla");
  });

  await test.step("envío, tapers a la vista y pago previsto: al recibir, en efectivo, con S/ 100", async () => {
    // 20 + 25 de platos, 3 tapers (el combo lleva 2) y S/ 3 de envío por defecto
    await expect(resumen).toContainText("3 tapers");
    await expect(resumen.getByText("Total", { exact: true }).locator("..")).toContainText("S/ 51.00");
    await resumen.getByRole("button", { name: "S/ 5", exact: true }).click();
    await expect(resumen.getByText("Total", { exact: true }).locator("..")).toContainText("S/ 53.00");

    // Sin pago previsto no se puede enviar
    await expect(boton(page, "Enviar a cocina")).toBeDisabled();
    await expect(resumen).toContainText("Elige cómo va a pagar");
    await resumen.getByRole("button", { name: "Paga al recibir" }).click();
    await resumen.getByRole("group", { name: "¿Con qué paga?" }).getByRole("button", { name: "Efectivo" }).click();
    await resumen.getByRole("button", { name: "S/ 100" }).click();
    await expect(resumen).toContainText("El motorizado lleva S/ 47.00 de vuelto");

    await page.keyboard.press("Control+Enter");
    await expect(page.getByRole("status").filter({ hasText: "enviado a cocina" })).toContainText("Total S/ 53.00");
  });

  const [primero] = await porTelefono();

  await test.step("el tablero lo muestra en cocina, con dirección, distrito y lo que debe cobrar el motorizado", async () => {
    expect(primero.distritoEntrega).toBe("Morales");
    const enCocina = columna("En cocina").getByRole("article");
    await expect(enCocina).toHaveCount(1);
    await expect(tarjeta(primero.numero)).toContainText("Rosa Pérez");
    await expect(tarjeta(primero.numero)).toContainText("Jr. San Martín 245, Morales · Portón verde");
    await expect(tarjeta(primero.numero)).toContainText("Cobrar S/ 53.00 · paga con S/ 100.00 · vuelto S/ 47.00");
    await expect(tarjeta(primero.numero).getByRole("link", { name: /Llamar/ })).toHaveAttribute("href", "tel:987111222");
  });

  await test.step("el cliente vuelve a llamar: se agrega una gaseosa como ronda nueva", async () => {
    await tarjeta(primero.numero).getByRole("button", { name: "Modificar" }).click();
    const dialogo = page.getByRole("dialog", { name: /Modificar el pedido/ });
    await dialogo.getByRole("combobox", { name: "Buscar en la carta" }).fill("gaseosa per");
    await dialogo.getByRole("combobox", { name: "Buscar en la carta" }).press("Enter");
    await dialogo.getByRole("button", { name: "Agregar al pedido: S/ 3.00" }).click();
    // El total y el vuelto se recalculan en el servidor
    await expect(dialogo.getByText("Total", { exact: true }).locator("..")).toContainText("S/ 56.00");
    await expect(dialogo.getByRole("region", { name: "Platos del pedido" })).toContainText("Gaseosa Personal");
    await page.keyboard.press("Escape");
    await expect(tarjeta(primero.numero)).toContainText("Cobrar S/ 56.00 · paga con S/ 100.00 · vuelto S/ 44.00");

    const [actual] = await porTelefono();
    expect(actual.items.map((i) => i.nombreProducto)).toEqual(["Ceviche Simple", "Combo Doble", "Gaseosa Personal"]);
    expect(new Set(actual.items.map((i) => i.idRonda)).size).toBe(2);
  });

  await test.step("cocina lo marca listo: pasa solo a \"Listo para salir\"", async () => {
    await marcarListo((await porTelefono())[0]);
    await expect(columna("Listo para salir").getByRole("article")).toHaveCount(1);
    await expect(columna("En cocina").getByRole("article")).toHaveCount(0);
  });

  await test.step("\"Salió\" asigna al único motorizado, y el resumen para él lleva mapa, total y vuelto", async () => {
    await tarjeta(primero.numero).getByRole("button", { name: "Salió" }).click();
    await expect(columna("En camino").getByRole("article")).toHaveCount(1);
    await expect(tarjeta(primero.numero)).toContainText("Motorizado");

    await tarjeta(primero.numero).getByRole("button", { name: "Enviar al motorizado" }).click();
    const abiertas = await page.evaluate(() => (window as unknown as { abiertas: string[] }).abiertas);
    expect(abiertas).toHaveLength(1);
    expect(abiertas[0]).toMatch(/^https:\/\/wa\.me\/51999888777\?text=/);
    const mensaje = decodeURIComponent(abiertas[0].split("?text=")[1]);
    expect(mensaje).toContain("Rosa Pérez · 987111222");
    expect(mensaje).toContain("Dirección: Jr. San Martín 245, Morales");
    expect(mensaje).toContain("Referencia: Portón verde");
    expect(mensaje).toContain("https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent("Jr. San Martín 245, Morales, San Martín, Perú"));
    expect(mensaje).toContain("Cobrar S/ 56.00 en efectivo");
    expect(mensaje).toContain("Paga con S/ 100.00: lleva S/ 44.00 de vuelto");
  });

  await test.step("\"Entregado\": queda por cobrar, y aparece lo que el motorizado debe rendir", async () => {
    await tarjeta(primero.numero).getByRole("button", { name: "Entregado" }).click();
    await expect(columna("Entregado").getByRole("article")).toHaveCount(1);
    await expect(tarjeta(primero.numero).getByRole("button", { name: "Cobrar S/ 56.00" })).toBeVisible();
    await expect(boton(page, /Motorizado debe rendir S\/ 56\.00 \(1 pedido\)/)).toBeVisible();
  });

  await test.step("cliente conocido: se autocompletan sus datos y \"Repetir pedido\" carga lo mismo", async () => {
    await page.keyboard.press("n");
    await page.getByLabel("Celular").fill("987111222");
    await expect(page.getByText("Cliente conocido")).toBeVisible();
    await expect(page.getByLabel("Nombre")).toHaveValue("Rosa Pérez");
    await expect(page.getByLabel("Dirección")).toHaveValue("Jr. San Martín 245");
    await expect(page.getByLabel("Distrito")).toHaveValue("Morales");
    await expect(page.getByLabel("Referencia")).toHaveValue("Portón verde");

    const ultimo = page.getByRole("region", { name: "Último pedido" });
    await expect(ultimo).toContainText("Ceviche Simple (Sin cebolla)");
    await ultimo.getByRole("button", { name: "Repetir pedido" }).click();
    await expect(anotados(page)).toHaveCount(3);
    await expect(anotados(page).filter({ hasText: "Combo Doble" })).toContainText("Leche de Tigre + Chaufa de Mariscos");
    await expect(anotados(page).filter({ hasText: "Ceviche Simple" })).toContainText("Sin cebolla");
    // 48 de platos + 3 tapers + S/ 3 de envío
    await expect(resumen.getByText("Total", { exact: true }).locator("..")).toContainText("S/ 54.00");

    await resumen.getByRole("button", { name: "Paga al recibir" }).click();
    await resumen.getByRole("group", { name: "¿Con qué paga?" }).getByRole("button", { name: "Efectivo" }).click();
    await resumen.getByRole("button", { name: "Exacto" }).click();
    await boton(page, "Enviar a cocina").click();
    await expect(page.getByRole("status").filter({ hasText: "enviado a cocina" })).toContainText("Total S/ 54.00");
  });

  const segundo = (await porTelefono())[1];

  await test.step("el segundo pedido también sale y se entrega", async () => {
    await marcarListo(segundo);
    await tarjeta(segundo.numero).getByRole("button", { name: "Salió" }).click();
    await tarjeta(segundo.numero).getByRole("button", { name: "Entregado" }).click();
    await expect(columna("Entregado").getByRole("article")).toHaveCount(2);
  });

  await test.step("rendición: el motorizado entrega todo y se cobra de una sola vez", async () => {
    const franja = boton(page, /Motorizado debe rendir S\/ 110\.00 \(2 pedidos\)/);
    await franja.click();
    const dialogo = page.getByRole("dialog", { name: "Rendición del motorizado" });
    await expect(dialogo.getByRole("listitem")).toHaveCount(2);
    await dialogo.getByRole("button", { name: "Cobrar todo: S/ 110.00" }).click();
    await expect(dialogo).toBeHidden();
    await expect(page.getByText(/Motorizado debe rendir/)).toBeHidden();
    await expect(tarjeta(primero.numero)).toContainText("Pagado");

    // Cada pedido es un cobro aparte, en efectivo, y la caja lo refleja (con el vuelto del primero)
    expect((await porTelefono()).map((p) => p.pagado)).toEqual([true, true]);
    const { cobrados } = await (await request.get("/api/caja/cobrados", token)).json();
    expect(cobrados).toHaveLength(2);
    const turno = (await (await request.get("/api/caja/actual", token)).json()).turno;
    expect(turno).toMatchObject({ totalesPorMetodo: { EFECTIVO: "110.00" }, vueltoEntregado: "44.00", pedidosCobrados: 2 });
  });

  await test.step("\"ya pagó por Yape\" queda por confirmar y entra a la caja una sola vez", async () => {
    const carta = await (await request.get("/api/carta", token)).json();
    const gaseosa = carta.categorias.flatMap((c: { productos: { nombre: string; variantes: { id: string }[] }[] }) => c.productos).find((p: { nombre: string }) => p.nombre === "Gaseosa Personal");
    const creado = await request.post("/api/pedidos", {
      ...token,
      data: {
        tipo: "PARA_LLEVAR",
        idCliente: crypto.randomUUID(),
        cliente: { telefono: "955444333", nombre: "Luis" },
        items: [{ varianteId: gaseosa.variantes[0].id, cantidad: 2 }],
        pagoPrevisto: { momento: "ANTICIPADO", metodo: "YAPE" },
      },
    });
    const { pedido } = (await creado.json()) as { pedido: Pedido };
    await expect(tarjeta(pedido.numero)).toContainText("Yape por confirmar · S/ 6.00");
    expect((await (await request.get("/api/caja/actual", token)).json()).turno.totalesPorMetodo.YAPE).toBe("0.00");

    await tarjeta(pedido.numero).getByRole("button", { name: "Confirmar pago" }).click();
    const dialogo = page.getByRole("dialog", { name: /Confirmar el pago/ });
    // El método ya viene elegido: el que dijo el cliente
    await expect(dialogo.getByRole("button", { name: "Yape" })).toHaveAttribute("aria-pressed", "true");
    await dialogo.getByRole("button", { name: "2. Cobrar S/ 6.00" }).click();
    await expect(dialogo).toBeHidden();
    await expect(tarjeta(pedido.numero)).toContainText("Pagado");
    await expect(tarjeta(pedido.numero).getByRole("button", { name: "Confirmar pago" })).toHaveCount(0);
    expect((await (await request.get("/api/caja/actual", token)).json()).turno.totalesPorMetodo.YAPE).toBe("6.00");
  });

  await request.post("/api/caja/cerrar", { ...token, data: { efectivoContado: 110 } });
  await contexto.close();
});
