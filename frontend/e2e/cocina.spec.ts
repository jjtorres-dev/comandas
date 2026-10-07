import { expect, test } from "@playwright/test";
import { boton, cancelarTodo, entrarComoMozo, type Mesa, mesasLibres, pedidoDeMesa, tokenDe } from "./ayudas";

// La cocina y el mozo a la vez: el mozo crea un pedido con combo, notas y una
// ronda; cocina lo ve llegar (con su aviso), marca Empezar y Listo, usa
// Deshacer, y el mozo recibe el aviso de LISTO.

let mesa: Mesa;

test.beforeAll(async ({ request }) => {
  [mesa] = await mesasLibres(request, 1);
});

test.afterAll(async ({ request }) => {
  if (!mesa) return;
  const token = await tokenDe(request, "admin", "admin123");
  await cancelarTodo(request, token, await pedidoDeMesa(request, token, mesa.id));
});

test("cocina ve llegar el pedido, lo prepara, deshace y el mozo recibe el aviso", async ({ browser, page: mozo, request }) => {
  // La pantalla de la cocina: un monitor
  const contextoCocina = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "es-PE" });
  const cocina = await contextoCocina.newPage();
  // Cada tono del aviso es un oscilador: se cuentan para saber cuántas veces sonó
  await cocina.addInitScript(() => {
    localStorage.setItem("comandas.negocio", "valentina");
    const w = window as unknown as { tonos: number };
    w.tonos = 0;
    const original = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function () {
      w.tonos += 1;
      return original.call(this);
    };
  });
  const avisos = async () => (await cocina.evaluate(() => (window as unknown as { tonos: number }).tonos)) / 3;
  const estados = async () => {
    const pedido = await pedidoDeMesa(request, tokenCocina, mesa.id);
    return pedido!.items.map((i) => `${i.nombreProducto}: ${i.estado}`);
  };
  const tokenCocina = await tokenDe(request, "cocina", "cocina123");

  await test.step("cocina abre el panel: activa el sonido", async () => {
    await cocina.goto("/login");
    await cocina.getByLabel("Usuario").fill("cocina");
    await cocina.getByRole("textbox", { name: "Contraseña" }).fill("cocina123");
    await boton(cocina, "Entrar").click();
    await expect(cocina).toHaveURL(/\/local\/cocina/);

    // Sin "Abrir cocina" no hay panel: el navegador no dejaría sonar
    await boton(cocina, "Abrir cocina").click();
    await expect(boton(cocina, "Todas")).toHaveAttribute("aria-pressed", "true");
    expect(await avisos()).toBe(1); // el aviso de muestra
  });

  const tarjeta = cocina.getByRole("article", { name: new RegExp(`${mesa.nombre}$`) });

  await test.step("el mozo envía un pedido con nota, combo con nota por plato y una bebida", async () => {
    await entrarComoMozo(mozo);
    await mozo.getByRole("link", { name: new RegExp(`^${mesa.nombre}\\b`) }).click();
    await boton(mozo, /^Ceviche Simple/).click();
    await boton(mozo, "Combos").click();
    await boton(mozo, /^Combo Doble/).click();
    const hojaCombo = mozo.getByRole("dialog", { name: "Combo Doble" });
    await hojaCombo.getByRole("button", { name: "Agregar Leche de Tigre" }).click();
    await hojaCombo.getByRole("button", { name: "Agregar Chaufa de Mariscos" }).click();
    await hojaCombo.getByRole("button", { name: "Agregar combo" }).click();
    await boton(mozo, "Bebidas").click();
    await boton(mozo, /^Gaseosa Personal/).click();
    await mozo.getByRole("link", { name: /Ver pedido/ }).click();

    const lineas = mozo.getByRole("main").getByRole("listitem");
    await lineas.filter({ hasText: "Ceviche Simple" }).getByRole("button", { name: "Nota" }).click();
    const notaCeviche = mozo.getByRole("dialog", { name: "Ceviche Simple" });
    await notaCeviche.getByRole("button", { name: "Sin cebolla" }).click();
    await notaCeviche.getByRole("button", { name: "Guardar nota" }).click();

    await lineas.filter({ hasText: "Combo Doble" }).getByRole("button", { name: "Nota" }).click();
    const notaCombo = mozo.getByRole("dialog", { name: "Combo Doble" });
    await notaCombo.getByRole("button", { name: "Leche de Tigre" }).click();
    await notaCombo.getByRole("button", { name: "Sin picante" }).click();
    await notaCombo.getByRole("button", { name: "Guardar nota" }).click();

    await boton(mozo, "Enviar a cocina").click();
    await expect(mozo).toHaveURL(/\/mozo\/mesas/);
  });

  await test.step("cocina lo ve aparecer con sus notas, agrupado por área, y suena el aviso", async () => {
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta).toContainText("NUEVO");
    await expect(tarjeta).toContainText("Sin cebolla");
    await expect(tarjeta).toContainText("Leche de Tigre: sin picante");
    await expect(tarjeta).toContainText("Leche de Tigre + Chaufa de Mariscos");
    await expect(tarjeta.getByRole("heading", { name: "Cocina" })).toBeVisible();
    await expect(tarjeta.getByRole("heading", { name: "Bebidas" })).toBeVisible();
    await expect.poll(avisos).toBe(2);
    // La pestaña Cocina dice cuántos pedidos están sin empezar
    await expect(cocina.getByRole("link", { name: /Cocina/ })).toContainText("1");
  });

  await test.step("Empezar todo, y una bebida suelta se marca lista con un toque", async () => {
    await tarjeta.getByRole("button", { name: "Empezar todo" }).click();
    await expect(tarjeta).not.toContainText("NUEVO");
    await expect(cocina.getByRole("status").filter({ hasText: "en preparación" })).toBeVisible();
    expect(await estados()).toEqual(["Ceviche Simple: PREPARANDO", "Combo Doble: PREPARANDO", "Gaseosa Personal: PREPARANDO"]);

    await tarjeta.getByRole("button", { name: "Marcar listo: 1 Gaseosa Personal" }).click();
    await expect(mozo.getByText(`${mesa.nombre}: 1 plato listo`)).toBeVisible();
  });

  await test.step("el mozo agrega una ronda: cocina la ve como bloque aparte, marcado NUEVO", async () => {
    await mozo.getByRole("link", { name: new RegExp(`^${mesa.nombre}\\b`) }).click();
    await mozo.getByRole("link", { name: "Agregar más" }).click();
    await boton(mozo, "Frituras").click();
    await boton(mozo, /^Pescado Frito/).click();
    await mozo.getByRole("link", { name: /Ver pedido/ }).click();
    await boton(mozo, "Enviar ronda").click();
    await expect(mozo).toHaveURL(/\/mozo\/mesas/);

    const ronda2 = tarjeta.getByRole("region", { name: "Ronda 2" });
    await expect(ronda2).toContainText("NUEVO");
    await expect(ronda2).toContainText("Pescado Frito");
    await expect(tarjeta.getByRole("region", { name: "Ronda 1" })).not.toContainText("NUEVO");
    await expect.poll(avisos).toBe(3);
  });

  await test.step("Todo listo: la tarjeta pasa a Recién listos", async () => {
    await tarjeta.getByRole("button", { name: "Todo listo" }).click();
    await expect(tarjeta).toBeHidden();
    await expect(cocina.getByText("1 recién listo")).toBeVisible();
    expect((await estados()).every((e) => e.endsWith("LISTO"))).toBe(true);
  });

  await test.step("Deshacer devuelve cada plato al estado exacto que tenía", async () => {
    await cocina.getByRole("status").getByRole("button", { name: "Deshacer" }).click();
    await expect(tarjeta).toBeVisible();
    // Deshacer manda un cambio por cada estado anterior: se espera a que terminen todos
    await expect
      .poll(estados)
      .toEqual(["Ceviche Simple: PREPARANDO", "Combo Doble: PREPARANDO", "Gaseosa Personal: LISTO", "Pescado Frito: PENDIENTE"]);
    await expect(tarjeta.getByRole("region", { name: "Ronda 2" })).toContainText("NUEVO");
  });

  await test.step("Listo de verdad: el mozo recibe el aviso de pedido listo", async () => {
    await tarjeta.getByRole("button", { name: "Todo listo" }).click();
    await expect(tarjeta).toBeHidden();
    await expect(mozo.getByText(`${mesa.nombre}: pedido listo`)).toBeVisible();
    expect(await mozo.evaluate(() => (window as unknown as { vibraciones?: unknown[] }).vibraciones?.length ?? 0)).toBeGreaterThanOrEqual(2);
  });

  await test.step("desde Recién listos se puede deshacer o entregar", async () => {
    await boton(cocina, /Entregado el pedido/).click();
    await expect(cocina.getByText("1 recién listo")).toBeHidden();
    expect((await estados()).every((e) => e.endsWith("ENTREGADO"))).toBe(true);
  });

  await contextoCocina.close();
});

test("recién listos reservado y ordenado por hora, cancelados tachados y filtro fijo", async ({ browser, request }) => {
  const tokenMozo = await tokenDe(request, "mozo", "mozo123");
  const tokenCocina = await tokenDe(request, "cocina", "cocina123");
  const tokenAdmin = await tokenDe(request, "admin", "admin123");
  const con = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });
  const carta = await (await request.get("/api/carta", con(tokenMozo))).json();
  const variante = (nombre: string): string =>
    carta.categorias.flatMap((c: { productos: { nombre: string; variantes: { id: string }[] }[] }) => c.productos).find((p: { nombre: string }) => p.nombre === nombre)
      .variantes[0].id;
  type Creado = { id: string; numero: number; items: { id: string }[] };
  const paraLlevar = async (cliente: string, platos: string[]): Promise<Creado> => {
    const respuesta = await request.post("/api/pedidos", {
      ...con(tokenMozo),
      data: { tipo: "PARA_LLEVAR", idCliente: crypto.randomUUID(), cliente: { nombre: cliente }, items: platos.map((p) => ({ varianteId: variante(p), cantidad: 1 })) },
    });
    expect(respuesta.status()).toBe(201);
    return (await respuesta.json()).pedido;
  };
  const marcar = (pedido: Creado, estado: string) =>
    request.patch(`/api/pedidos/${pedido.id}/items/estado`, { ...con(tokenCocina), data: { itemIds: pedido.items.map((i) => i.id), estado } });

  // "Caro" es el más antiguo: los que salgan después no deben moverlo
  const tercero = await paraLlevar("Caro", ["Ceviche Mixto", "Yuca Frita"]);
  const primero = await paraLlevar("Ana", ["Jalea Mixta"]);
  const segundo = await paraLlevar("Beto", ["Parihuela"]);

  const contexto = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "es-PE" });
  const cocina = await contexto.newPage();
  await cocina.addInitScript(() => localStorage.setItem("comandas.negocio", "valentina"));
  await cocina.goto("/login");
  await cocina.getByLabel("Usuario").fill("cocina");
  await cocina.getByRole("textbox", { name: "Contraseña" }).fill("cocina123");
  await boton(cocina, "Entrar").click();
  await boton(cocina, "Abrir cocina").click();

  const tarjeta = (cliente: string) => cocina.getByRole("article", { name: new RegExp(cliente) });
  const columna = cocina.getByRole("complementary", { name: "Recién listos" });

  await test.step("la columna está reservada aunque no haya nada listo", async () => {
    await expect(tarjeta("Caro")).toBeVisible();
    await expect(tarjeta("Beto")).toBeVisible();
    await expect(columna).toContainText("Nada listo aún");
  });

  await test.step("al aparecer un pedido listo, las tarjetas no cambian de ancho ni de lugar", async () => {
    const antes = await tarjeta("Caro").boundingBox();
    // Se marca listo primero el pedido MÁS NUEVO de los dos, y después el más antiguo
    await marcar(segundo, "LISTO");
    await expect(cocina.getByText("1 recién listo")).toBeVisible();
    await marcar(primero, "LISTO");
    await expect(cocina.getByText("2 recién listos")).toBeVisible();
    const despues = await tarjeta("Caro").boundingBox();
    expect(despues!.width).toBe(antes!.width);
    expect(despues!.x).toBe(antes!.x);
  });

  await test.step("recién listos va por la hora en que se marcó listo, no por la de llegada", async () => {
    const titulos = cocina.locator("details li p:first-child");
    await expect(titulos).toHaveText([new RegExp(`#${primero.numero} `), new RegExp(`#${segundo.numero} `)]);
  });

  await test.step("un plato cancelado se ve tachado un momento y después desaparece", async () => {
    await request.patch(`/api/pedidos/${tercero.id}/items/${tercero.items[1].id}/cancelar`, con(tokenAdmin));
    const cancelado = tarjeta("Caro").getByRole("listitem").filter({ hasText: "Yuca Frita" });
    await expect(cancelado).toContainText("Cancelado");
    await expect(cancelado).toBeHidden({ timeout: 12_000 });
    await expect(tarjeta("Caro")).toContainText("Ceviche Mixto");
  });

  await test.step("un pedido cancelado entero se despide tachado, sin botones", async () => {
    await request.patch(`/api/pedidos/${tercero.id}/items/${tercero.items[0].id}/cancelar`, con(tokenAdmin));
    await expect(tarjeta("Caro")).toContainText("Cancelado: ya no se prepara");
    await expect(tarjeta("Caro").getByRole("button")).toHaveCount(0);
    await expect(tarjeta("Caro")).toBeHidden({ timeout: 12_000 });
  });

  await test.step("entre 1024 y 1279 px el filtro queda fijo bajo la cabecera al desplazar", async () => {
    for (const cliente of ["Dani", "Eli", "Fede"]) await paraLlevar(cliente, ["Ceviche Mixto", "Jalea Mixta", "Parihuela", "Yuca Frita"]);
    await cocina.setViewportSize({ width: 1100, height: 700 });
    await expect(tarjeta("Fede")).toBeVisible();
    await cocina.mouse.wheel(0, 600);
    const filtro = boton(cocina, "Todas");
    await expect(filtro).toBeInViewport();
    const alto = await cocina.evaluate(() => document.querySelector("header")!.getBoundingClientRect().bottom);
    const y = (await filtro.boundingBox())!.y;
    expect(y).toBeGreaterThanOrEqual(alto);
    expect(y).toBeLessThan(alto + 40);
    expect(await cocina.evaluate(() => scrollY)).toBeGreaterThan(300);
  });

  await contexto.close();
});
