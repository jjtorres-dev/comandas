import type { Request, Response } from "express";
import { sesionDe } from "../../middlewares/auth";
import { esquemaBuscarCliente } from "./clientes.schemas";
import * as servicio from "./clientes.service";

export async function buscar(req: Request, res: Response) {
  const { telefono } = esquemaBuscarCliente.parse(req.query);
  res.json({ cliente: await servicio.buscarPorTelefono(sesionDe(req).negocioId, telefono) });
}
