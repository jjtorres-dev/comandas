import type { Request, Response } from "express";
import { sesionDe } from "../../middlewares/auth";
import { esquemaLogin } from "./auth.schemas";
import * as servicio from "./auth.service";

export async function login(req: Request, res: Response) {
  res.json(await servicio.login(esquemaLogin.parse(req.body)));
}

export async function yo(req: Request, res: Response) {
  res.json(await servicio.yo(sesionDe(req)));
}
