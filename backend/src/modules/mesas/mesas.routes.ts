import { Router } from "express";
import { Rol } from "../../generated/prisma/client.js";
import { requireAuth, requireRol } from "../../middlewares/auth.js";
import * as controlador from "./mesas.controller.js";

export const rutasMesas = Router();

rutasMesas.use(requireAuth);

rutasMesas.get("/", requireRol(Rol.MOZO, Rol.LOCAL, Rol.ADMIN), controlador.listarMesas);
