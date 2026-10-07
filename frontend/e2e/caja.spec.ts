import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { boton, con, limpiarActivos, mesasLibres, tokenDe } from "./ayudas";

// La caja de punta a punta, en el monitor con mouse y teclado: abrir caja,
// cobro mixto con vuelto, nota de venta, cuenta dividida por platos (incluida
// 1 unidad de una línea de 2), un cobro con el método equivocado y su
// corrección, una anulación, y el cierre con diferencia.

type Creado = { id: string; numero: number; total: string };

async function crear(api: APIRequestContext, token: string, datos: object, platos: [string, number, number?][]): Promise<Creado> {
  const carta = await (await api.get("/api/carta", con(token))).json();
  const productos = carta.categorias.flatMap((c: { productos: { nombre: string; variantes: { id: string }[] }[] }) => c.productos);
  const items = platos.map(([nombre, cantidad, variante = 0]) => ({
    varianteId: productos.find((p: { nombre: string }) => p.nombre === nombre).variantes[variante].id,
    cantidad,
  }));
  const respuesta = await api.post("/api/pedidos", { ...con(token), data: { idCliente: crypto.randomUUID(), items, ...datos } });
  expect(respuesta.status()).toBe(201);
  return (await respuesta.json()).pedido;
}

// En la franja, el nombre del método y su total son celdas contiguas
const total = (metodo: string, monto: string) => new RegExp(`${metodo}\\s*S/ ${monto.replace(".", "\\.")}`);

// La pantalla del vuelto ignora un Enter (o un clic) inmediato, para que una
// tecla de más no se la lleve: una persona tarda más que esto en leerla
const leerElVuelto = (page: Page) => page.waitForTimeout(800);

const esperadoEn = async (franja: ReturnType<Page["getByRole"]>) =>
  Number((await franja.getByText("Efectivo esperado").locator("..").locator("dd").innerText()).replace("S/ ", ""));

// Lo cobrado sin entregar sigue activo en cocina: se limpia para las demás pruebas
test.afterAll(async ({ request }) => {
  await limpiarActivos(request);
});

test("abrir caja, cobrar mixto, dividir por platos, corregir un pago y cerrar con diferencia", async ({ browser, request }) => {
  const tokenMozo = await tokenDe(request, "mozo", "mozo123");
  const tokenCaja = await tokenDe(request, "cocina", "cocina123");
  const [mesaA, mesaB] = await mesasLibres(request, 2);
  // A: 2 ceviches (40) + pota de S/ 10 + gaseosa (3) = 53. B: 2 ceviches (40) + jalea (40) = 80
  const pedidoA = await crear(request, tokenMozo, { tipo: "MESA", mesaId: mesaA.id }, [["Ceviche Simple", 2], ["Chicharrón de Pota", 1], ["Gaseosa Personal", 1]]);
  const pedidoB = await crear(request, tokenMozo, { tipo: "MESA", mesaId: mesaB.id }, [["Ceviche Simple", 2], ["Jalea Mixta", 1]]);
  const pedidoC = await crear(request, tokenMozo, { tipo: "PARA_LLEVAR", cliente: { nombre: "Rosa" } }, [["Parihuela", 1]]);
  expect([pedidoA.total, pedidoB.total]).toEqual(["53.00", "80.00"]);
  const totalC = Number(pedidoC.total);

  const contexto = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "es-PE", permissions: ["clipboard-read", "clipboard-write"] });
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
  await page.getByRole("link", { name: "Caja" }).click();

  const lista = page.getByRole("navigation", { name: "Por cobrar" });
  const cuenta = page.getByRole("region", { name: "Cuenta" });
  const cobro = page.getByRole("region", { name: "Cobro" });
  const franja = page.getByRole("complementary", { name: "Caja de este turno" });
  const fila = (numero: number) => lista.getByRole("button", { name: new RegExp(`#${numero}\\b`) });

  await test.step("sin caja abierta no se cobra: pide el sencillo y abre", async () => {
    await expect(page.getByRole("heading", { name: "La caja está cerrada" })).toBeVisible();
    await expect(page.getByText("3 pedidos esperan cobro")).toBeVisible();
    await page.getByLabel(/Con cuánto sencillo abres/).fill("100");
    await page.keyboard.press("Enter");
    await expect(franja).toContainText("Efectivo esperado");
    expect(await esperadoEn(franja)).toBe(100);
    await expect(lista.getByRole("button")).toHaveCount(3);
  });

  await test.step("cobro mixto: Yape 20 + efectivo 33 con S/ 50, vuelto S/ 17", async () => {
    await fila(pedidoA.numero).click();
    await expect(cuenta).toContainText("Total");
    await expect(cobro).toContainText("S/ 53.00");
    // Ningún método viene elegido: no se puede cobrar todavía
    await expect(cobro.getByText("1. ¿Cómo paga?")).toBeVisible();
    await expect(cobro.getByRole("button", { name: "Primero elige cómo paga" })).toBeDisabled();
    // Los pasos aparecen al avanzar: en efectivo, cuánto entrega y recién después cobrar
    await cobro.getByRole("button", { name: "Efectivo" }).click();
    await expect(cobro.getByLabel("2. ¿Cuánto entrega?")).toBeFocused();
    await expect(cobro.getByRole("button", { name: "3. Cobrar S/ 53.00" })).toBeEnabled();
    await cobro.getByRole("button", { name: "Yape" }).click();
    await expect(cobro.getByRole("button", { name: "2. Cobrar S/ 53.00" })).toBeEnabled();

    await cobro.getByRole("button", { name: "Agregar otro método" }).click();
    const parte1 = cobro.getByRole("group", { name: "Pago 1" });
    const parte2 = cobro.getByRole("group", { name: "Pago 2" });
    await parte1.getByRole("textbox", { name: "Pago 1" }).fill("20");
    // La otra parte se ajusta sola a lo que falta
    await expect(parte2.getByRole("textbox", { name: "Pago 2" })).toHaveValue("33");
    await parte1.getByLabel(/N.º de operación/).fill("OP 4471");
    await parte2.getByRole("button", { name: "Efectivo" }).click();

    // Con menos de lo que toca, no deja cobrar
    await parte2.getByLabel("¿Cuánto entrega?").fill("30");
    await expect(cobro.getByText("Faltan", { exact: true }).locator("..")).toContainText("S/ 3.00");
    await expect(cobro.getByRole("button", { name: "Cobrar S/ 53.00" })).toBeDisabled();
    await parte2.getByRole("button", { name: "S/ 50" }).click();
    await expect(cobro.getByText("Vuelto", { exact: true }).locator("..")).toContainText("S/ 17.00");
    // El pago que ya está listo se pliega: el vuelto y Cobrar siguen a la vista
    await expect(cobro.getByRole("button", { name: "Cobrar S/ 53.00" })).toBeInViewport({ ratio: 1 });
    await expect(cobro.getByText("Vuelto", { exact: true })).toBeInViewport({ ratio: 1 });

    await cobro.getByRole("button", { name: "Cobrar S/ 53.00" }).click();
    await expect(cobro).toContainText("Cobrado S/ 53.00");
    await expect(cobro.getByText("Vuelto a entregar").locator("..")).toContainText("S/ 17.00");
    await expect(franja).toContainText(total("Yape", "20.00"));
    await expect.poll(() => esperadoEn(franja)).toBe(133);
  });

  await test.step("nota de venta: copiar el texto y enviarla por WhatsApp pidiendo el teléfono", async () => {
    await cobro.getByRole("button", { name: "Copiar texto" }).click();
    await expect(cobro.getByRole("button", { name: "Copiado" })).toBeVisible();
    const copiado = await page.evaluate(() => navigator.clipboard.readText());
    expect(copiado).toContain("*TOTAL: S/ 53.00*");
    expect(copiado).toContain("Pago: Yape S/ 20.00 + Efectivo S/ 33.00");

    // El pedido de mesa no tiene teléfono: lo pide ahí mismo
    await cobro.getByRole("button", { name: "Enviar por WhatsApp" }).click();
    await cobro.getByLabel("WhatsApp del cliente").fill("987 654 321");
    await cobro.getByRole("button", { name: "Enviar por WhatsApp" }).click();
    const abiertas = await page.evaluate(() => (window as unknown as { abiertas: string[] }).abiertas);
    expect(abiertas).toHaveLength(1);
    expect(abiertas[0]).toMatch(/^https:\/\/wa\.me\/51987654321\?text=.*TOTAL/);
  });

  await test.step("dividir por platos con el teclado: 1 de los 2 ceviches con Plin", async () => {
    await leerElVuelto(page);
    await cobro.getByRole("button", { name: "Siguiente" }).click();
    // Pasa solo al siguiente pedido por cobrar
    await expect(cuenta.getByRole("heading")).toContainText(`#${pedidoB.numero}`);
    // El método del cobro anterior no se arrastra al pedido siguiente
    await expect(cobro.getByRole("button", { pressed: true })).toHaveCount(0);
    await cuenta.getByRole("button", { name: "Por platos" }).click();
    await expect(cobro).toContainText("Marca los platos que se cobran");
    await cuenta.getByRole("button", { name: "Una unidad más de Ceviche Simple" }).click();
    await expect(cobro).toContainText("Platos marcados");
    await expect(cobro).toContainText("S/ 20.00");

    await page.keyboard.press("p");
    await expect(cobro.getByRole("button", { name: "Plin" })).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Enter");
    await expect(cobro).toContainText("Cobrado S/ 20.00");
    await expect(cobro).toContainText("Falta cobrar S/ 60.00");

    // Un Enter inmediato no se lleva la pantalla; pasado un momento, sigue con la misma cuenta
    await page.keyboard.press("Enter");
    await expect(cobro).toContainText("Cobrado S/ 20.00");
    await leerElVuelto(page);
    await page.keyboard.press("Enter");
    await expect(cuenta).toContainText("1 de 2 pagado");
    await expect(cuenta).toContainText("Saldo");
  });

  await test.step("el resto de los platos con tarjeta: la cuenta queda pagada", async () => {
    await cuenta.getByRole("checkbox", { name: "Cobrar Ceviche Simple" }).click();
    await cuenta.getByRole("checkbox", { name: "Cobrar Jalea Mixta" }).click();
    await expect(cobro).toContainText("S/ 60.00");
    await page.keyboard.press("t");
    await page.keyboard.press("Enter");
    await expect(cobro).toContainText("La cuenta quedó pagada");

    const { cuenta: enApi } = await (await request.get(`/api/pedidos/${pedidoB.id}/cuenta`, con(tokenCaja))).json();
    expect(enApi.pagado).toBe(true);
    expect(enApi.items.map((i: { cantidadPagada: number }) => i.cantidadPagada)).toEqual([2, 1]);
    expect(enApi.pagos.map((p: { metodo: string; monto: string }) => `${p.metodo} ${p.monto}`)).toEqual(["PLIN 20.00", "TARJETA 60.00"]);
    await expect(franja).toContainText(total("Plin", "20.00"));
    await expect(franja).toContainText(total("Tarjeta", "60.00"));
  });

  await test.step("se cobra con el método equivocado: era efectivo y se marcó Yape", async () => {
    await leerElVuelto(page);
    await page.keyboard.press("Enter"); // Siguiente
    await expect(cuenta.getByRole("heading")).toContainText("Rosa");
    await page.keyboard.press("y");
    await page.keyboard.press("Enter");
    await expect(cobro).toContainText("La cuenta quedó pagada");
    // Como Yape, el efectivo esperado no se mueve
    await expect(franja).toContainText(total("Yape", (20 + totalC).toFixed(2)));
    expect(await esperadoEn(franja)).toBe(133);
  });

  await test.step("se corrige desde Cobrados de este turno: el efectivo esperado cambia", async () => {
    await page.getByRole("tab", { name: /Cobrados de este turno/ }).click();
    const cobrados = page.getByRole("list", { name: "Cobrados de este turno" }).getByRole("article");
    // El más reciente primero
    await expect(cobrados).toHaveCount(3);
    await expect(cobrados.first()).toContainText("Rosa");

    await cobrados.first().getByRole("button", { name: "Cambiar método" }).click();
    const dialogo = page.getByRole("dialog", { name: /Cambiar el método/ });
    await expect(dialogo).toContainText("Está registrado como Yape");
    await dialogo.getByRole("button", { name: "Efectivo" }).click();
    await dialogo.getByRole("button", { name: "Guardar el cambio" }).click();
    await expect(dialogo).toBeHidden();

    await expect(cobrados.first()).toContainText(`Efectivo S/ ${totalC.toFixed(2)}`);
    await expect.poll(() => esperadoEn(franja)).toBe(133 + totalC);
    await expect(franja).toContainText(total("Yape", "20.00"));
  });

  await test.step("anular un pago pide motivo, y el pedido vuelve a Por cobrar", async () => {
    const delA = page.getByRole("article", { name: new RegExp(`Pedido ${pedidoA.numero},`) });
    await delA.getByRole("listitem").filter({ hasText: "Yape" }).getByRole("button", { name: "Anular pago" }).click();
    const dialogo = page.getByRole("dialog", { name: /Anular un pago/ });
    await expect(dialogo.getByRole("button", { name: /Anular Yape S\/ 20.00/ })).toBeDisabled();
    await dialogo.getByLabel(/Por qué se anula/).fill("Se cobró de más");
    await dialogo.getByRole("button", { name: /Anular Yape S\/ 20.00/ }).click();
    await expect(dialogo).toBeHidden();

    await expect(delA).toContainText("Anulado por Cocina: Se cobró de más");
    await expect(franja).toContainText("1 pago anulado");
    await expect(franja).toContainText(total("Yape", "0.00"));

    // Anular un pago de un pedido que ya estaba pagado reabre su cuenta, sin ocupar la mesa
    const delB = page.getByRole("article", { name: new RegExp(`Pedido ${pedidoB.numero},`) });
    await delB.getByRole("listitem").filter({ hasText: "Tarjeta" }).getByRole("button", { name: "Anular pago" }).click();
    await dialogo.getByLabel(/Por qué se anula/).fill("Pasó dos veces la tarjeta");
    await dialogo.getByRole("button", { name: /Anular Tarjeta S\/ 60.00/ }).click();
    await expect(dialogo).toBeHidden();
    await expect(franja).toContainText("2 pagos anulados");

    await page.getByRole("tab", { name: /Por cobrar/ }).click();
    await expect(fila(pedidoB.numero)).toContainText(`${mesaB.nombre} · cuenta reabierta`);
    await expect(fila(pedidoB.numero)).toContainText("S/ 60.00");
    const mesas = (await (await request.get("/api/mesas", con(tokenCaja))).json()).mesas as { id: string; estado: string }[];
    expect(mesas.find((m) => m.id === mesaB.id)?.estado).toBe("libre");
    await expect(fila(pedidoA.numero)).toContainText("S/ 20.00");
    await expect(fila(pedidoA.numero)).toContainText("Falta de S/ 53.00");
  });

  await test.step("cerrar caja: se cuenta el efectivo, se ve la diferencia y se confirma", async () => {
    const esperado = await esperadoEn(franja);
    await franja.getByRole("button", { name: "Cerrar caja" }).click();
    const dialogo = page.getByRole("dialog", { name: "Cerrar caja" });
    await expect(dialogo).toContainText("2 pedidos quedan sin cobrar");
    await expect(dialogo.getByRole("button", { name: "Confirmar cierre" })).toBeDisabled();
    await dialogo.getByLabel(/Cuánto efectivo hay en el cajón/).fill(String(esperado));
    await expect(dialogo).toContainText("Cuadra");
    await dialogo.getByLabel(/Cuánto efectivo hay en el cajón/).fill(String(esperado - 5));
    await expect(dialogo).toContainText("Falta S/ 5.00");
    // Con diferencia, un Enter no cierra: hay que confirmarla con el botón, dos veces
    await page.keyboard.press("Enter");
    await expect(dialogo).toBeVisible();
    await dialogo.getByRole("button", { name: "Cerrar con S/ 5.00 de falta" }).click();
    await dialogo.getByRole("button", { name: "Sí, cerrar así" }).click();

    await expect(page.getByRole("heading", { name: "La caja está cerrada" })).toBeVisible();
    const resumen = page.getByRole("region", { name: "Resumen del cierre" });
    await expect(resumen).toContainText("Falta S/ 5.00");
    await expect(resumen).toContainText("2 pagos anulados");

    const turno = (await (await request.get("/api/caja/actual", con(tokenCaja))).json()).turno;
    expect(turno).toBeNull();
  });

  await contexto.close();
});
