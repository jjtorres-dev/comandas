import type { Request, Response } from "express";
import { esquemaCodigoNegocio } from "./negocios.schemas";
import * as servicio from "./negocios.service";

export async function publico(req: Request, res: Response) {
  const { codigo } = esquemaCodigoNegocio.parse(req.params);
  res.json(await servicio.datosPublicos(codigo));
}
