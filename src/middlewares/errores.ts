import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ErrorApp } from "../lib/errores";

export function rutaNoEncontrada(req: Request, res: Response) {
  res.status(404).json({
    error: { codigo: "NO_ENCONTRADO", mensaje: `No existe la ruta ${req.method} ${req.path}` },
  });
}

// Único punto donde los errores se convierten en respuesta JSON
export function manejarErrores(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ErrorApp) {
    res.status(err.status).json({ error: { codigo: err.codigo, mensaje: err.message, ...err.extra } });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        codigo: "DATOS_INVALIDOS",
        mensaje: "Los datos enviados no son válidos",
        detalles: err.issues.map((i) => ({ campo: i.path.join("."), mensaje: i.message })),
      },
    });
    return;
  }

  // Errores de express.json(): cuerpo mal formado o demasiado grande
  const tipo = (err as { type?: string } | null)?.type;
  if (tipo === "entity.parse.failed") {
    res.status(400).json({ error: { codigo: "JSON_INVALIDO", mensaje: "El cuerpo no es un JSON válido" } });
    return;
  }
  if (tipo === "entity.too.large") {
    res.status(413).json({ error: { codigo: "CUERPO_MUY_GRANDE", mensaje: "El cuerpo de la solicitud es demasiado grande" } });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" } });
}
