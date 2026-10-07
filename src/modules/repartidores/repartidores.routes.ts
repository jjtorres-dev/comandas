import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import * as controlador from "./repartidores.controller";

export const rutasRepartidores = Router();

rutasRepartidores.use(requireAuth);

rutasRepartidores.get("/", controlador.listarActivos);
