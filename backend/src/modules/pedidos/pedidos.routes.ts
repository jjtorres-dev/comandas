import { Router } from "express";
import { Rol } from "../../generated/prisma/client.js";
import { requireAuth, requireRol } from "../../middlewares/auth.js";
import * as controlador from "./pedidos.controller.js";

export const rutasPedidos = Router();

rutasPedidos.use(requireAuth);

const operaPedidos = requireRol(Rol.MOZO, Rol.LOCAL, Rol.ADMIN);
const manejaCaja = requireRol(Rol.LOCAL, Rol.ADMIN);

rutasPedidos.get("/activos", controlador.listarActivos);
rutasPedidos.get("/por-telefono", controlador.listarPorTelefono);
rutasPedidos.post("/", operaPedidos, controlador.crearPedido);
rutasPedidos.post("/:id/items", operaPedidos, controlador.agregarItems);
rutasPedidos.patch("/:id/items/estado", operaPedidos, controlador.cambiarEstadoItems);
rutasPedidos.patch("/:id/items/:itemId/cancelar", operaPedidos, controlador.cancelarItem);
rutasPedidos.patch("/:id/cargos", manejaCaja, controlador.actualizarCargos);
rutasPedidos.patch("/:id/repartidor", operaPedidos, controlador.asignarRepartidor);
rutasPedidos.patch("/:id/estado", operaPedidos, controlador.cambiarEstadoPedido);
rutasPedidos.patch("/:id/entrega", manejaCaja, controlador.actualizarEntrega);
rutasPedidos.patch("/:id/cancelar", manejaCaja, controlador.cancelarPedido);
