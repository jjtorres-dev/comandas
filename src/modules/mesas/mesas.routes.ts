import { Router } from "express";
import { Rol } from "../../generated/prisma/client";
import { requireAuth, requireRol } from "../../middlewares/auth";
import * as controlador from "./mesas.controller";

export const rutasMesas = Router();

rutasMesas.use(requireAuth);

rutasMesas.get("/", requireRol(Rol.MOZO, Rol.LOCAL, Rol.ADMIN), controlador.listarMesas);
