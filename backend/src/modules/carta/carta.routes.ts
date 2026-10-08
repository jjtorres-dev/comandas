import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.js";
import * as controlador from "./carta.controller.js";

export const rutasCarta = Router();

rutasCarta.use(requireAuth);

rutasCarta.get("/", controlador.obtenerCarta);
