// Ayudas compartidas por las pruebas de punta a punta
import { type APIRequestContext, expect, type Page } from "@playwright/test";

export type Item = { id: string; estado: string; nombreProducto: string; cantidad: number; notas: string[]; componentes: string[]; idRonda: string };
export type Pedido = { id: string; total: string; nota: string | null; mesa: { id: string } | null; items: Item[] };

export async function tokenDe(api: APIRequestContext, usuario: string, password: string): Promise<string> {
  const respuesta = await api.post("/api/auth/login", { data: { codigoNegocio: "valentina", usuario, password } });
  expect(respuesta.ok(), `login de ${usuario}`).toBeTruthy();
  return (await respuesta.json()).token;
}

export const con = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

export async function pedidoDeMesa(api: APIRequestContext, token: string, mesaId: string): Promise<Pedido | undefined> {
  const { pedidos } = (await (await api.get("/api/pedidos/activos", con(token))).json()) as { pedidos: Pedido[] };
  return pedidos.find((p) => p.mesa?.id === mesaId);
}

export const boton = (page: Page, nombre: string | RegExp) => page.getByRole("button", { name: nombre });

// El negocio ya está recordado en el equipo, y la vibración se registra para comprobarla
export async function entrarComoMozo(page: Page) {
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
  await page.goto("/login");
  await page.getByLabel("Usuario").fill("mozo");
  await page.getByRole("textbox", { name: "Contraseña" }).fill("mozo123");
  await boton(page, "Entrar").click();
  await expect(page).toHaveURL(/\/mozo\/mesas/);
}

export async function cancelarTodo(api: APIRequestContext, token: string, pedido: Pedido | undefined) {
  for (const item of pedido?.items ?? []) {
    if (item.estado !== "CANCELADO") await api.patch(`/api/pedidos/${pedido!.id}/items/${item.id}/cancelar`, con(token));
  }
}

export type Mesa = { id: string; nombre: string; estado: string };

export async function mesasLibres(api: APIRequestContext, cuantas: number): Promise<Mesa[]> {
  const token = await tokenDe(api, "mozo", "mozo123");
  const { mesas } = (await (await api.get("/api/mesas", con(token))).json()) as { mesas: Mesa[] };
  const libres = mesas.filter((m) => m.estado === "libre");
  expect(libres.length, `Hacen falta ${cuantas} mesas libres. Cobra o cancela pedidos, o corre \`npm run db:seed\` en backend/`).toBeGreaterThanOrEqual(cuantas);
  return libres;
}

// Deja la base de pruebas sin pedidos activos, para que el archivo siguiente
// empiece limpio. Lo que no tiene pagos se cancela; lo demás se termina de
// cobrar (abriendo la caja un momento si hace falta) y se marca entregado.
export async function limpiarActivos(api: APIRequestContext) {
  const token = con(await tokenDe(api, "admin", "admin123"));
  type Activo = Pedido & { pagado: boolean; totalPagado: string; saldoPendiente: string };
  const activos = async () => ((await (await api.get("/api/pedidos/activos", token)).json()) as { pedidos: Activo[] }).pedidos;
  const vivos = (pedido: Activo) => pedido.items.filter((i) => i.estado !== "CANCELADO");

  for (const pedido of await activos()) {
    if (pedido.pagado || Number(pedido.totalPagado) > 0) continue;
    for (const item of vivos(pedido)) await api.patch(`/api/pedidos/${pedido.id}/items/${item.id}/cancelar`, token);
  }

  const conPagos = await activos();
  if (conPagos.length === 0) return;
  const abrio = (await api.post("/api/caja/abrir", { ...token, data: { montoInicial: 0 } })).ok();
  for (const pedido of conPagos) {
    if (!pedido.pagado) await api.post(`/api/pedidos/${pedido.id}/pagos`, { ...token, data: { pagos: [{ metodo: "YAPE", monto: Number(pedido.saldoPendiente) }] } });
    await api.patch(`/api/pedidos/${pedido.id}/items/estado`, { ...token, data: { itemIds: vivos(pedido).map((i) => i.id), estado: "ENTREGADO" } });
  }
  if (abrio) await api.post("/api/caja/cerrar", { ...token, data: { efectivoContado: 0 } });
}
