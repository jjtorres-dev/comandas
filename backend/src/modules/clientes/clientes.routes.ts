import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import * as controlador from "./clientes.controller";

export const rutasClientes = Router();

rutasClientes.use(requireAuth);

rutasClientes.get("/buscar", controlador.buscar);
