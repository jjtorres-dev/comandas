import { Router } from "express";
import { Rol } from "../../generated/prisma/client";
import { requireAuth, requireRol } from "../../middlewares/auth";
import * as controlador from "./caja.controller";

export const rutasCaja = Router();

rutasCaja.use(requireAuth, requireRol(Rol.LOCAL, Rol.ADMIN));

rutasCaja.post("/abrir", controlador.abrir);
rutasCaja.get("/actual", controlador.actual);
rutasCaja.post("/cerrar", controlador.cerrar);
