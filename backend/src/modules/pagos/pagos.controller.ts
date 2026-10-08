import type { Request, Response } from "express";
import { sesionDe } from "../../middlewares/auth.js";
import { esquemaParamsPedido } from "../pedidos/pedidos.schemas.js";
import { esquemaAnularPago, esquemaCambiarMetodo, esquemaParamsPago, esquemaRegistrarPagos } from "./pagos.schemas.js";
import * as servicio from "./pagos.service.js";

export async function obtenerCuenta(req: Request, res: Response) {
  const { id } = esquemaParamsPedido.parse(req.params);
  res.json({ cuenta: await servicio.obtenerCuenta(sesionDe(req).negocioId, id) });
}

export async function registrarPagos(req: Request, res: Response) {
  const { id } = esquemaParamsPedido.parse(req.params);
  const datos = esquemaRegistrarPagos.parse(req.body);
  const { creado, ...respuesta } = await servicio.registrarPagos(sesionDe(req), id, datos);
  // 200 si era un reintento con el mismo idCobro
  res.status(creado ? 201 : 200).json(respuesta);
}

export async function notaDeVenta(req: Request, res: Response) {
  const { id } = esquemaParamsPedido.parse(req.params);
  res.json(await servicio.notaDeVenta(sesionDe(req).negocioId, id));
}

export async function cambiarMetodo(req: Request, res: Response) {
  const { id, pagoId } = esquemaParamsPago.parse(req.params);
  res.json(await servicio.cambiarMetodo(sesionDe(req), id, pagoId, esquemaCambiarMetodo.parse(req.body)));
}

export async function anularPago(req: Request, res: Response) {
  const { id, pagoId } = esquemaParamsPago.parse(req.params);
  res.json(await servicio.anularPago(sesionDe(req), id, pagoId, esquemaAnularPago.parse(req.body)));
}
