import { Router } from "express";
import { Rol } from "../../generated/prisma/client";
import { requireAuth, requireRol } from "../../middlewares/auth";
import * as controlador from "./pagos.controller";

// Se monta en /api/pedidos, junto a las rutas de pedidos
export const rutasPagos = Router();

rutasPagos.use(requireAuth);

rutasPagos.get("/:id/cuenta", controlador.obtenerCuenta);
rutasPagos.post("/:id/pagos", requireRol(Rol.LOCAL, Rol.ADMIN), controlador.registrarPagos);
rutasPagos.get("/:id/nota-venta", controlador.notaDeVenta);
// Correcciones de un pago del turno abierto
rutasPagos.patch("/:id/pagos/:pagoId/metodo", requireRol(Rol.LOCAL, Rol.ADMIN), controlador.cambiarMetodo);
rutasPagos.patch("/:id/pagos/:pagoId/anular", requireRol(Rol.LOCAL, Rol.ADMIN), controlador.anularPago);
