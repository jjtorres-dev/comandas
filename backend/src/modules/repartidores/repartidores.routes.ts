import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import * as controlador from "./repartidores.controller.js";

export const rutasRepartidores = Router();

rutasRepartidores.use(requireAuth);

rutasRepartidores.get("/", controlador.listarActivos);
