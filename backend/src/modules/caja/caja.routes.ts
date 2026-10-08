import { Router } from "express";
import { Rol } from "../../generated/prisma/client.js";
import { requireAuth, requireRol } from "../../middlewares/auth.js";
import * as controlador from "./caja.controller.js";

export const rutasCaja = Router();

rutasCaja.use(requireAuth, requireRol(Rol.LOCAL, Rol.ADMIN));

rutasCaja.post("/abrir", controlador.abrir);
rutasCaja.get("/actual", controlador.actual);
rutasCaja.get("/cobrados", controlador.cobrados);
rutasCaja.post("/cerrar", controlador.cerrar);
