import type { Request, Response } from "express";
import { sesionDe } from "../../middlewares/auth";
import {
  esquemaAgregarItems,
  esquemaCambiarEstado,
  esquemaCancelarPedido,
  esquemaCargos,
  esquemaCrearPedido,
  esquemaEntrega,
  esquemaEstadoPedido,
  esquemaFiltroActivos,
  esquemaParamsItem,
  esquemaParamsPedido,
  esquemaRepartidor,
} from "./pedidos.schemas";
import * as servicio from "./pedidos.service";

export async function crearPedido(req: Request, res: Response) {
  const { pedido, creado } = await servicio.crearPedido(sesionDe(req), esquemaCrearPedido.parse(req.body));
  // 200 si era un reintento con el mismo idCliente
  res.status(creado ? 201 : 200).json({ pedido });
}

export async function agregarItems(req: Request, res: Response) {
  const { id } = esquemaParamsPedido.parse(req.params);
  const datos = esquemaAgregarItems.parse(req.body);
  const { pedido, creado } = await servicio.agregarItems(sesionDe(req), id, datos);
  // 200 si era un reintento con el mismo idRonda
  res.status(creado ? 201 : 200).json({ pedido });
}

export async function listarActivos(req: Request, res: Response) {
  const { areaId } = esquemaFiltroActivos.parse(req.query);
  res.json({ pedidos: await servicio.listarActivos(sesionDe(req).negocioId, areaId) });
}

export async function cambiarEstadoItems(req: Request, res: Response) {
  const { id } = esquemaParamsPedido.parse(req.params);
  const datos = esquemaCambiarEstado.parse(req.body);
  res.json({ pedido: await servicio.cambiarEstadoItems(sesionDe(req), id, datos) });
}

export async function cancelarItem(req: Request, res: Response) {
  const { id, itemId } = esquemaParamsItem.parse(req.params);
  res.json({ pedido: await servicio.cancelarItem(sesionDe(req), id, itemId) });
}

export async function actualizarCargos(req: Request, res: Response) {
  const { id } = esquemaParamsPedido.parse(req.params);
  const datos = esquemaCargos.parse(req.body);
  res.json({ pedido: await servicio.actualizarCargos(sesionDe(req), id, datos) });
}

export async function asignarRepartidor(req: Request, res: Response) {
  const { id } = esquemaParamsPedido.parse(req.params);
  const { repartidorId } = esquemaRepartidor.parse(req.body);
  res.json({ pedido: await servicio.asignarRepartidor(sesionDe(req), id, repartidorId) });
}

export async function cambiarEstadoPedido(req: Request, res: Response) {
  const { id } = esquemaParamsPedido.parse(req.params);
  const { estado } = esquemaEstadoPedido.parse(req.body);
  res.json({ pedido: await servicio.cambiarEstadoPedido(sesionDe(req), id, estado) });
}

export async function listarPorTelefono(req: Request, res: Response) {
  res.json({ pedidos: await servicio.listarPorTelefono(sesionDe(req).negocioId) });
}

export async function actualizarEntrega(req: Request, res: Response) {
  const { id } = esquemaParamsPedido.parse(req.params);
  res.json({ pedido: await servicio.actualizarEntrega(sesionDe(req), id, esquemaEntrega.parse(req.body)) });
}

export async function cancelarPedido(req: Request, res: Response) {
  const { id } = esquemaParamsPedido.parse(req.params);
  const { motivo } = esquemaCancelarPedido.parse(req.body);
  res.json({ pedido: await servicio.cancelarPedido(sesionDe(req), id, motivo) });
}
