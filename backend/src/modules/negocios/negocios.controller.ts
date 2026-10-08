import type { Request, Response } from "express";
import { esquemaCodigoNegocio } from "./negocios.schemas.js";
import * as servicio from "./negocios.service.js";

export async function publico(req: Request, res: Response) {
  const { codigo } = esquemaCodigoNegocio.parse(req.params);
  res.json(await servicio.datosPublicos(codigo));
}

// La dirección del logo cambia con cada imagen nueva (?v=…), así que se puede
// guardar en caché sin miedo a servir una vieja
export async function logo(req: Request, res: Response) {
  const { codigo } = esquemaCodigoNegocio.parse(req.params);
  const { imagen, tipo } = await servicio.logoDe(codigo);
  res.set({ "Content-Type": tipo, "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" });
  res.send(Buffer.from(imagen));
}
