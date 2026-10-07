// Lo que el mozo anotó y todavía no llega a cocina vive en el celular:
// borradores (sin enviar) y cola (enviados que el servidor aún no confirma).
// Se guarda por usuario en localStorage, así sobrevive a cerrar la app.
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { api, ErrorApi } from "../lib/api";
import { claves, clienteDeConsultas } from "../lib/consultas";
import type { Pedido } from "../lib/tipos";
import { almacen as sesion } from "../sesion/almacen";
import { comoItems, type Linea, unir } from "./lineas";
import { nuevoId } from "./uuid";

export type Destino = { tipo: "MESA"; mesaId: string; nombre: string } | { tipo: "PARA_LLEVAR"; nombre: string };

export const PARA_LLEVAR: Destino = { tipo: "PARA_LLEVAR", nombre: "Para llevar" };

// Cada pedido para llevar se anota en su propio borrador
export const claveParaLlevar = (): string => `llevar-${nuevoId()}`;
export const esParaLlevar = (clave: string): boolean => clave === "llevar" || clave.startsWith("llevar-");

export type Borrador = {
  // "mesa-<id>", "llevar-<id propio>" (cada para llevar tiene su borrador) o
  // "pedido-<id>" (ronda de un pedido para llevar)
  clave: string;
  destino: Destino;
  lineas: Linea[];
  nota: string;
  // Para llevar: a nombre de quién (opcional)
  cliente: string;
  // Por qué el servidor lo devolvió, si lo devolvió
  motivo: string | null;
};

export type Envio = Omit<Borrador, "motivo"> & {
  // idCliente del pedido nuevo o idRonda de la ronda: el mismo en cada reintento
  id: string;
  // Con pedidoId es una ronda; sin él, un pedido nuevo
  pedidoId: string | null;
  intentos: number;
  // "conflicto": la mesa resultó ocupada y el mozo debe decidir
  estado: "pendiente" | "conflicto";
  conflictoPedidoId: string | null;
};

type Estado = {
  usuarioId: string | null;
  borradores: Record<string, Borrador>;
  cola: Envio[];
  // No se guardan: qué envío está en vuelo y si la lista de la cola está abierta
  enviando: string | null;
  colaAbierta: boolean;
};

const VACIO: Estado = { usuarioId: null, borradores: {}, cola: [], enviando: null, colaAbierta: false };

let estado: Estado = VACIO;
const oyentes = new Set<() => void>();

const claveDe = (usuarioId: string) => `comandas.mozo.${usuarioId}`;

function cambiar(parcial: Partial<Estado>) {
  estado = { ...estado, ...parcial };
  if (estado.usuarioId && ("borradores" in parcial || "cola" in parcial)) {
    try {
      localStorage.setItem(claveDe(estado.usuarioId), JSON.stringify({ borradores: estado.borradores, cola: estado.cola }));
    } catch {
      // sin almacenamiento, la cola dura lo que dure la pestaña
    }
  }
  for (const oyente of oyentes) oyente();
}

const suscribir = (oyente: () => void) => {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
};

export const useMozo = (): Estado => useSyncExternalStore(suscribir, () => estado);

// ---------- Sesión ----------

export function abrir(usuarioId: string) {
  let guardado: Pick<Estado, "borradores" | "cola"> = { borradores: {}, cola: [] };
  try {
    const texto = localStorage.getItem(claveDe(usuarioId));
    if (texto) guardado = { ...guardado, ...(JSON.parse(texto) as typeof guardado) };
  } catch {
    // datos ilegibles: se empieza de cero
  }
  estado = { ...VACIO, usuarioId, ...guardado };
  for (const oyente of oyentes) oyente();
  void procesarCola();
}

// Al salir no se borra nada del dispositivo: la cola sigue ahí para la próxima sesión
export function cerrar() {
  clearTimeout(reloj);
  estado = VACIO;
  for (const oyente of oyentes) oyente();
}

// ---------- Borradores ----------

export function editarBorrador(clave: string, destino: Destino, cambio: Partial<Pick<Borrador, "lineas" | "nota" | "cliente">>) {
  const actual = estado.borradores[clave] ?? { clave, destino, lineas: [], nota: "", cliente: "", motivo: null };
  const siguiente = { ...actual, destino, ...cambio };
  const borradores = { ...estado.borradores };
  // Un borrador sin platos no es un borrador
  if (siguiente.lineas.length === 0) delete borradores[clave];
  else borradores[clave] = siguiente;
  cambiar({ borradores });
}

export const leerBorrador = (clave: string): Borrador | undefined => estado.borradores[clave];

export function descartarBorrador(clave: string) {
  const borradores = { ...estado.borradores };
  delete borradores[clave];
  cambiar({ borradores });
}

// ---------- Cola ----------

// "Enviar a cocina": el borrador pasa a la cola con su id definitivo y la
// pantalla no espera al servidor
export function enviar(clave: string, pedidoId: string | null) {
  const borrador = estado.borradores[clave];
  if (!borrador || borrador.lineas.length === 0) return;
  const borradores = { ...estado.borradores };
  delete borradores[clave];
  const envio: Envio = {
    id: nuevoId(),
    clave,
    destino: borrador.destino,
    lineas: borrador.lineas,
    nota: borrador.nota,
    cliente: borrador.cliente,
    pedidoId,
    intentos: 0,
    estado: "pendiente",
    conflictoPedidoId: null,
  };
  cambiar({ borradores, cola: [...estado.cola, envio] });
  void procesarCola();
}

const actualizarEnvio = (id: string, cambio: Partial<Envio>) =>
  cambiar({ cola: estado.cola.map((e) => (e.id === id ? { ...e, ...cambio } : e)) });

const quitarEnvio = (id: string) => cambiar({ cola: estado.cola.filter((e) => e.id !== id) });

export const descartarEnvio = quitarEnvio;

export const abrirCola = (abierta: boolean) => cambiar({ colaAbierta: abierta });

// El envío vuelve a ser un borrador editable (se une a lo que ya hubiera ahí)
function devolverABorrador(envio: Envio, motivo: string | null, clave = envio.clave, destino = envio.destino) {
  const previo = estado.borradores[clave];
  const borrador: Borrador = {
    clave,
    destino,
    lineas: unir([...(previo?.lineas ?? []), ...envio.lineas]),
    nota: previo?.nota || envio.nota,
    cliente: previo?.cliente || envio.cliente,
    motivo,
  };
  cambiar({ cola: estado.cola.filter((e) => e.id !== envio.id), borradores: { ...estado.borradores, [clave]: borrador } });
}

// Mesa ocupada (409): el mozo eligió sumar lo anotado al pedido abierto
export function resolverComoRonda(id: string) {
  const envio = estado.cola.find((e) => e.id === id);
  if (!envio?.conflictoPedidoId) return;
  actualizarEnvio(id, { id: nuevoId(), pedidoId: envio.conflictoPedidoId, estado: "pendiente", conflictoPedidoId: null, intentos: 0 });
  void procesarCola();
}

// Mesa ocupada (409): el mozo prefiere revisar antes; lo anotado queda como borrador
export function resolverRevisando(id: string) {
  const envio = estado.cola.find((e) => e.id === id);
  if (envio) devolverABorrador(envio, null);
}

let ocupado = false;
let reloj: ReturnType<typeof setTimeout> | undefined;

// Una petición que no responde en este tiempo cuenta como fallo de red: si se
// quedara colgada, la cola entera dejaría de avanzar
const ESPERA_MAXIMA = 15_000;

// Espera creciente entre reintentos: 2 s, 4 s, 8 s… hasta 30 s
const esperaDe = (intentos: number) => Math.min(30_000, 2000 * 2 ** Math.max(0, intentos - 1));

// Envía la cola en orden. Se llama al encolar, al abrir la app, al volver la
// red o el tiempo real, y sola tras cada fallo.
export async function procesarCola(): Promise<void> {
  if (ocupado || !estado.usuarioId || !sesion.leer().token) return;
  clearTimeout(reloj);
  ocupado = true;
  // Los que fallaron en esta pasada: se reintentan en la siguiente
  const aplazados = new Set<string>();
  try {
    for (;;) {
      const envio = estado.cola.find((e) => e.estado === "pendiente" && !aplazados.has(e.id));
      if (!envio) break;
      cambiar({ enviando: envio.id });
      const resultado = await intentar(envio);
      if (resultado === "seguir") continue;
      aplazados.add(envio.id);
      // Sin red no tiene sentido probar con los demás; un error del servidor
      // con este pedido no debe frenar a los que vienen detrás
      if (resultado === "sin-red") break;
    }
  } finally {
    ocupado = false;
    if (estado.usuarioId) cambiar({ enviando: null });
  }
  const pendientes = estado.cola.filter((e) => e.estado === "pendiente");
  if (pendientes.length > 0) {
    reloj = setTimeout(() => void procesarCola(), esperaDe(Math.min(...pendientes.map((e) => e.intentos))));
  }
}

export function reintentarAhora() {
  clearTimeout(reloj);
  void procesarCola();
}

type Resultado = "seguir" | "sin-red" | "despues";

async function intentar(envio: Envio): Promise<Resultado> {
  const usuarioId = estado.usuarioId;
  const items = comoItems(envio.lineas);
  try {
    if (envio.pedidoId) {
      await api<{ pedido: Pedido }>(`/pedidos/${envio.pedidoId}/items`, {
        metodo: "POST",
        // La nota general de un pedido que entra como ronda se suma a la del pedido abierto
        cuerpo: { idRonda: envio.id, items, ...(envio.nota.trim() ? { nota: envio.nota.trim() } : {}) },
        signal: AbortSignal.timeout(ESPERA_MAXIMA),
      });
    } else {
      const cliente = envio.cliente.trim();
      await api<{ pedido: Pedido }>("/pedidos", {
        metodo: "POST",
        signal: AbortSignal.timeout(ESPERA_MAXIMA),
        cuerpo: {
          tipo: envio.destino.tipo,
          idCliente: envio.id,
          items,
          ...(envio.destino.tipo === "MESA" ? { mesaId: envio.destino.mesaId } : {}),
          ...(envio.nota.trim() ? { nota: envio.nota.trim() } : {}),
          ...(envio.destino.tipo === "PARA_LLEVAR" && cliente ? { cliente: { nombre: cliente } } : {}),
        },
      });
    }
  } catch (causa) {
    // La sesión cambió mientras se esperaba: la cola guardada se retoma al volver a entrar
    if (estado.usuarioId !== usuarioId) return "sin-red";
    return alFallar(envio, causa);
  }
  if (estado.usuarioId !== usuarioId) return "sin-red";
  quitarEnvio(envio.id);
  void clienteDeConsultas.invalidateQueries({ queryKey: claves.pedidos });
  void clienteDeConsultas.invalidateQueries({ queryKey: claves.mesas });
  toast.success(`${envio.destino.nombre}: ${envio.pedidoId ? "ronda enviada" : "pedido enviado"} a cocina`, { id: `enviado-${envio.id}` });
  return "seguir";
}

function alFallar(envio: Envio, causa: unknown): Resultado {
  const error = causa instanceof ErrorApi ? causa : null;
  // Sin red, servidor caído o sesión vencida: el pedido se queda en la cola
  if (!error || error.status === 0 || error.status >= 500 || error.status === 429 || error.status === 401) {
    actualizarEnvio(envio.id, { intentos: envio.intentos + 1 });
    return !error || error.status === 0 || error.status === 401 ? "sin-red" : "despues";
  }
  if (error.codigo === "MESA_OCUPADA" && typeof error.extra.pedidoId === "string") {
    actualizarEnvio(envio.id, { estado: "conflicto", conflictoPedidoId: error.extra.pedidoId });
    void clienteDeConsultas.invalidateQueries({ queryKey: claves.mesas });
    return "seguir";
  }
  if (error.codigo === "ID_CLIENTE_EN_USO") {
    actualizarEnvio(envio.id, { id: nuevoId() });
    return "seguir";
  }
  // Rechazo definitivo: repetirlo no cambia nada. Vuelve como borrador con el motivo.
  const pedidoCerrado = envio.pedidoId !== null && ["PEDIDO_PAGADO", "PEDIDO_CANCELADO", "NO_ENCONTRADO"].includes(error.codigo);
  // Una ronda de un pedido para llevar que ya cerró pasa a ser un pedido nuevo,
  // con su propio borrador: no se mezcla con otro para llevar que se esté anotando
  if (pedidoCerrado && envio.destino.tipo === "PARA_LLEVAR") {
    devolverABorrador(envio, error.message, claveParaLlevar(), PARA_LLEVAR);
  } else {
    devolverABorrador(envio, error.message);
  }
  void clienteDeConsultas.invalidateQueries({ queryKey: claves.pedidos });
  void clienteDeConsultas.invalidateQueries({ queryKey: claves.mesas });
  toast.error(`${envio.destino.nombre}: no se pudo enviar. ${error.message}`, { id: `rechazado-${envio.id}`, duration: 8000 });
  return "seguir";
}
