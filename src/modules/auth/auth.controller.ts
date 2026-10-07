import type { Request, Response } from "express";
import { esquemaLogin } from "./auth.schemas";
import * as servicio from "./auth.service";

export async function login(req: Request, res: Response) {
  res.json(await servicio.login(esquemaLogin.parse(req.body)));
}
