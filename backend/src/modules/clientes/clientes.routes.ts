import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import * as controlador from "./clientes.controller.js";

export const rutasClientes = Router();

rutasClientes.use(requireAuth);

rutasClientes.get("/buscar", controlador.buscar);
rutasClientes.get("/ultimo-pedido", controlador.ultimoPedido);
