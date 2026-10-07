import type { Request, Response } from "express";
import { sesionDe } from "../../middlewares/auth";
import * as servicio from "./carta.service";

export async function obtenerCarta(req: Request, res: Response) {
  res.json(await servicio.obtenerCarta(sesionDe(req).negocioId));
}
