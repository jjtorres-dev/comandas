import express, { Router } from "express";
import { Rol } from "../../generated/prisma/client";
import { requireAuth, requireRol } from "../../middlewares/auth";
import * as controlador from "./admin.controller";
import { LOGO_MAXIMO } from "./negocio.admin";

export const rutasAdmin = Router();

// Todo lo de administración es solo del dueño
rutasAdmin.use(requireAuth, requireRol(Rol.ADMIN));

rutasAdmin.get("/carta", controlador.verCarta);
rutasAdmin.post("/categorias", controlador.crearCategoria);
rutasAdmin.patch("/categorias/:id", controlador.editarCategoria);
rutasAdmin.delete("/categorias/:id", controlador.eliminarCategoria);
rutasAdmin.post("/categorias/:id/mover", controlador.moverCategoria);
rutasAdmin.post("/productos", controlador.crearProducto);
rutasAdmin.patch("/productos/:id", controlador.editarProducto);
rutasAdmin.delete("/productos/:id", controlador.eliminarProducto);
rutasAdmin.post("/productos/:id/mover", controlador.moverProducto);
rutasAdmin.patch("/variantes/:id/precio", controlador.cambiarPrecio);

rutasAdmin.get("/usuarios", controlador.verUsuarios);
rutasAdmin.post("/usuarios", controlador.crearUsuario);
rutasAdmin.patch("/usuarios/:id", controlador.editarUsuario);
rutasAdmin.put("/usuarios/:id/password", controlador.cambiarPassword);

rutasAdmin.get("/mesas", controlador.verMesas);
rutasAdmin.post("/mesas", controlador.crearMesa);
rutasAdmin.patch("/mesas/:id", controlador.editarMesa);
rutasAdmin.delete("/mesas/:id", controlador.eliminarMesa);
rutasAdmin.post("/mesas/:id/mover", controlador.moverMesa);

rutasAdmin.get("/repartidores", controlador.verRepartidores);
rutasAdmin.post("/repartidores", controlador.crearRepartidor);
rutasAdmin.patch("/repartidores/:id", controlador.editarRepartidor);
rutasAdmin.delete("/repartidores/:id", controlador.eliminarRepartidor);

rutasAdmin.get("/notas", controlador.verNotas);
rutasAdmin.post("/notas", controlador.crearNota);
rutasAdmin.patch("/notas/:id", controlador.editarNota);
rutasAdmin.delete("/notas/:id", controlador.eliminarNota);
rutasAdmin.post("/notas/:id/mover", controlador.moverNota);

rutasAdmin.get("/negocio", controlador.verNegocio);
rutasAdmin.patch("/negocio", controlador.editarNegocio);
// La imagen viaja tal cual en el cuerpo, con su Content-Type
rutasAdmin.put("/negocio/logo", express.raw({ type: ["image/png", "image/jpeg", "image/webp"], limit: LOGO_MAXIMO }), controlador.subirLogo);
rutasAdmin.delete("/negocio/logo", controlador.quitarLogo);

rutasAdmin.get("/reportes", controlador.verReporte);
