import type { Request, Response } from "express";
import { sesionDe } from "../../middlewares/auth";
import * as servicio from "./repartidores.service";

export async function listarActivos(req: Request, res: Response) {
  res.json({ repartidores: await servicio.listarActivos(sesionDe(req).negocioId) });
}
