import { Router } from "express";
import { requireAuth } from "../../middlewares/auth";
import * as controlador from "./carta.controller";

export const rutasCarta = Router();

rutasCarta.use(requireAuth);

rutasCarta.get("/", controlador.obtenerCarta);
