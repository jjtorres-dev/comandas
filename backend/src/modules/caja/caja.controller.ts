import type { Request, Response } from "express";
import { sesionDe } from "../../middlewares/auth";
import { esquemaAbrirCaja, esquemaCerrarCaja } from "./caja.schemas";
import * as servicio from "./caja.service";

export async function abrir(req: Request, res: Response) {
  res.status(201).json({ turno: await servicio.abrirCaja(sesionDe(req), esquemaAbrirCaja.parse(req.body)) });
}

export async function actual(req: Request, res: Response) {
  res.json({ turno: await servicio.cajaActual(sesionDe(req).negocioId) });
}

export async function cerrar(req: Request, res: Response) {
  res.json(await servicio.cerrarCaja(sesionDe(req), esquemaCerrarCaja.parse(req.body)));
}

export async function cobrados(req: Request, res: Response) {
  res.json({ cobrados: await servicio.cobradosDelTurno(sesionDe(req).negocioId) });
}
