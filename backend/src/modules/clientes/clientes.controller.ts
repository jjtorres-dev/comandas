import type { Request, Response } from "express";
import { sesionDe } from "../../middlewares/auth.js";
import { esquemaBuscarCliente } from "./clientes.schemas.js";
import { ultimoPedidoDe } from "../pedidos/pedidos.service.js";
import * as servicio from "./clientes.service.js";

export async function buscar(req: Request, res: Response) {
  const { telefono } = esquemaBuscarCliente.parse(req.query);
  res.json({ cliente: await servicio.buscarPorTelefono(sesionDe(req).negocioId, telefono) });
}

export async function ultimoPedido(req: Request, res: Response) {
  const { telefono } = esquemaBuscarCliente.parse(req.query);
  res.json({ pedido: await ultimoPedidoDe(sesionDe(req).negocioId, telefono) });
}
