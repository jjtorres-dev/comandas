// Cliente de la API: agrega el token, convierte los errores del backend en
// ErrorApi y avisa cuando la sesión deja de valer.

// Vacío = mismo origen (en desarrollo, Vite reenvía al backend)
export const URL_SERVIDOR = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

// Códigos de backend/docs/API.md, más SIN_CONEXION, que es solo del cliente
export type CodigoError =
  | "DATOS_INVALIDOS"
  | "SOLICITUD_INVALIDA"
  | "JSON_INVALIDO"
  | "NO_AUTENTICADO"
  | "SIN_PERMISO"
  | "NO_ENCONTRADO"
  | "CUERPO_MUY_GRANDE"
  | "DEMASIADOS_INTENTOS"
  | "ERROR_INTERNO"
  | "MESA_OCUPADA"
  | "ID_CLIENTE_EN_USO"
  | "PEDIDO_PAGADO"
  | "PEDIDO_CANCELADO"
  | "PEDIDO_CON_PAGOS"
  | "PEDIDO_NO_LISTO"
  | "ITEM_CANCELADO"
  | "ITEM_PAGADO"
  | "TOTAL_MENOR_A_LO_PAGADO"
  | "NO_ES_DELIVERY"
  | "SIN_CAJA_ABIERTA"
  | "CAJA_YA_ABIERTA"
  | "PAGO_EXCEDE_SALDO"
  | "CON_HISTORIAL"
  | "USUARIO_EN_USO"
  | "ES_TU_USUARIO"
  | "ULTIMO_ADMIN"
  | "SIN_CONEXION"
  | (string & {});

export type DetalleError = { campo: string; mensaje: string };

export class ErrorApi extends Error {
  readonly status: number;
  readonly codigo: CodigoError;
  // Campos extra del error (pedidoId, saldoPendiente, detalles…)
  readonly extra: Record<string, unknown>;

  constructor(status: number, codigo: CodigoError, mensaje: string, extra: Record<string, unknown> = {}) {
    super(mensaje);
    this.name = "ErrorApi";
    this.status = status;
    this.codigo = codigo;
    this.extra = extra;
  }

  // Solo en DATOS_INVALIDOS: qué campo falló y por qué
  get detalles(): DetalleError[] {
    return Array.isArray(this.extra.detalles) ? (this.extra.detalles as DetalleError[]) : [];
  }
}

export const esErrorApi = (error: unknown, codigo?: CodigoError): error is ErrorApi =>
  error instanceof ErrorApi && (codigo === undefined || error.codigo === codigo);

// Mensaje listo para mostrar: el backend ya los manda en español
export const mensajeDe = (error: unknown): string =>
  error instanceof ErrorApi ? error.message : "Ocurrió un error inesperado. Vuelve a intentarlo";

type Conexion = {
  obtenerToken: () => string | null;
  alPerderSesion: (mensaje: string) => void;
};

let conexion: Conexion = { obtenerToken: () => null, alPerderSesion: () => {} };

// Lo llama el módulo de sesión una sola vez al arrancar
export function configurarApi(nueva: Conexion) {
  conexion = nueva;
}

type Opciones = {
  metodo?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  cuerpo?: unknown;
  // Un archivo que viaja tal cual en el cuerpo (el logo), con su propio tipo
  archivo?: Blob;
  signal?: AbortSignal;
};

// ruta relativa a /api, p. ej. api("/pedidos/activos")
export async function api<T>(ruta: string, { metodo = "GET", cuerpo, archivo, signal }: Opciones = {}): Promise<T> {
  const token = conexion.obtenerToken();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (archivo) headers["Content-Type"] = archivo.type;
  else if (cuerpo !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let respuesta: Response;
  try {
    respuesta = await fetch(`${URL_SERVIDOR}/api${ruta}`, {
      method: metodo,
      headers,
      body: archivo ?? (cuerpo === undefined ? undefined : JSON.stringify(cuerpo)),
      signal,
    });
  } catch (causa) {
    if (causa instanceof DOMException && causa.name === "AbortError") throw causa;
    throw new ErrorApi(0, "SIN_CONEXION", "No se pudo conectar con el servidor. Revisa tu conexión y vuelve a intentarlo");
  }

  // Un 204 no trae cuerpo
  const datos: unknown = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    const error = leerError(respuesta.status, datos);
    // Un 401 con token significa que la sesión venció o fue revocada.
    // Sin token es un login fallido: eso lo muestra el formulario.
    if (respuesta.status === 401 && token) conexion.alPerderSesion(error.message);
    throw error;
  }

  return datos as T;
}

function leerError(status: number, datos: unknown): ErrorApi {
  const error = (datos as { error?: Record<string, unknown> } | null)?.error;
  if (error && typeof error.codigo === "string" && typeof error.mensaje === "string") {
    const { codigo, mensaje, ...extra } = error;
    return new ErrorApi(status, codigo, mensaje, extra);
  }
  // La respuesta no vino del backend (proxy caído, HTML de error…)
  return new ErrorApi(status, "ERROR_INTERNO", "El servidor no respondió como se esperaba. Vuelve a intentarlo");
}

// logoUrl: una ruta del servidor (/api/negocios/<codigo>/logo?v=…) o una URL absoluta
export function urlDeArchivo(ruta: string): string {
  return /^https?:\/\//.test(ruta) ? ruta : `${URL_SERVIDOR}${ruta}`;
}
