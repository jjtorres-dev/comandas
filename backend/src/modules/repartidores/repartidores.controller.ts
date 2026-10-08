import type { Request, Response } from "express";
import { sesionDe } from "../../middlewares/auth.js";
import * as servicio from "./repartidores.service.js";

export async function listarActivos(req: Request, res: Response) {
  res.json({ repartidores: await servicio.listarActivos(sesionDe(req).negocioId) });
}
