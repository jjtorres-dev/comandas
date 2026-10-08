import type { Request, Response } from "express";
import { sesionDe } from "../../middlewares/auth.js";
import * as servicio from "./mesas.service.js";

export async function listarMesas(req: Request, res: Response) {
  res.json({ mesas: await servicio.listarMesas(sesionDe(req).negocioId) });
}
