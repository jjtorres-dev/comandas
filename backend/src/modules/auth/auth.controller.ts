import type { Request, Response } from "express";
import { sesionDe } from "../../middlewares/auth.js";
import { esquemaLogin } from "./auth.schemas.js";
import * as servicio from "./auth.service.js";

export async function login(req: Request, res: Response) {
  res.json(await servicio.login(esquemaLogin.parse(req.body)));
}

export async function yo(req: Request, res: Response) {
  res.json(await servicio.yo(sesionDe(req)));
}
