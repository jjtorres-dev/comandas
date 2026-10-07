// Error de negocio con código HTTP. El middleware de errores lo convierte en
// { error: { codigo, mensaje, ...extra } }
export class ErrorApp extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensaje: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(mensaje);
    this.name = "ErrorApp";
  }
}

export const solicitudInvalida = (mensaje: string, extra?: Record<string, unknown>) =>
  new ErrorApp(400, "SOLICITUD_INVALIDA", mensaje, extra);

export const noAutenticado = (mensaje = "Debes iniciar sesión") =>
  new ErrorApp(401, "NO_AUTENTICADO", mensaje);

export const sinPermiso = (mensaje = "No tienes permiso para realizar esta acción") =>
  new ErrorApp(403, "SIN_PERMISO", mensaje);

export const noEncontrado = (mensaje: string) => new ErrorApp(404, "NO_ENCONTRADO", mensaje);

export const conflicto = (codigo: string, mensaje: string, extra?: Record<string, unknown>) =>
  new ErrorApp(409, codigo, mensaje, extra);
