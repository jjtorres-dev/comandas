import type { Request, Response } from "express";
import { sesionDe } from "../../middlewares/auth";
import { esquemaParamsPedido } from "../pedidos/pedidos.schemas";
import { esquemaRegistrarPagos } from "./pagos.schemas";
import * as servicio from "./pagos.service";

export async function obtenerCuenta(req: Request, res: Response) {
  const { id } = esquemaParamsPedido.parse(req.params);
  res.json({ cuenta: await servicio.obtenerCuenta(sesionDe(req).negocioId, id) });
}

export async function registrarPagos(req: Request, res: Response) {
  const { id } = esquemaParamsPedido.parse(req.params);
  const datos = esquemaRegistrarPagos.parse(req.body);
  res.status(201).json(await servicio.registrarPagos(sesionDe(req), id, datos));
}

export async function notaDeVenta(req: Request, res: Response) {
  const { id } = esquemaParamsPedido.parse(req.params);
  res.json(await servicio.notaDeVenta(sesionDe(req).negocioId, id));
}
