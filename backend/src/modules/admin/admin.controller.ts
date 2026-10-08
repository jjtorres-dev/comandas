import type { Request, Response } from "express";
import { solicitudInvalida } from "../../lib/errores.js";
import { sesionDe } from "../../middlewares/auth.js";
import * as e from "./admin.schemas.js";
import * as carta from "./carta.admin.js";
import * as local from "./local.admin.js";
import * as negocio from "./negocio.admin.js";
import * as personal from "./personal.admin.js";
import * as reportes from "./reportes.admin.js";

const negocioDe = (req: Request) => sesionDe(req).negocioId;
const idDe = (req: Request) => e.esquemaId.parse(req.params).id;
const direccionDe = (req: Request) => e.esquemaMover.parse(req.body).direccion;

// ---------- Carta ----------

export async function verCarta(req: Request, res: Response) {
  res.json(await carta.cartaCompleta(negocioDe(req)));
}
export async function crearCategoria(req: Request, res: Response) {
  res.status(201).json(await carta.crearCategoria(negocioDe(req), e.esquemaCategoria.parse(req.body).nombre));
}
export async function editarCategoria(req: Request, res: Response) {
  await carta.editarCategoria(negocioDe(req), idDe(req), e.esquemaEditarCategoria.parse(req.body));
  res.status(204).end();
}
export async function eliminarCategoria(req: Request, res: Response) {
  await carta.eliminarCategoria(negocioDe(req), idDe(req));
  res.status(204).end();
}
export async function moverCategoria(req: Request, res: Response) {
  await carta.moverCategoria(negocioDe(req), idDe(req), direccionDe(req));
  res.status(204).end();
}
export async function crearProducto(req: Request, res: Response) {
  res.status(201).json(await carta.crearProducto(negocioDe(req), e.esquemaCrearProducto.parse(req.body)));
}
export async function editarProducto(req: Request, res: Response) {
  await carta.editarProducto(negocioDe(req), idDe(req), e.esquemaEditarProducto.parse(req.body));
  res.status(204).end();
}
export async function eliminarProducto(req: Request, res: Response) {
  await carta.eliminarProducto(negocioDe(req), idDe(req));
  res.status(204).end();
}
export async function moverProducto(req: Request, res: Response) {
  await carta.moverProducto(negocioDe(req), idDe(req), direccionDe(req));
  res.status(204).end();
}
export async function cambiarPrecio(req: Request, res: Response) {
  res.json(await carta.cambiarPrecio(negocioDe(req), idDe(req), e.esquemaPrecio.parse(req.body).precio));
}

// ---------- Personal ----------

export async function verUsuarios(req: Request, res: Response) {
  res.json({ usuarios: await personal.listarUsuarios(negocioDe(req)) });
}
export async function crearUsuario(req: Request, res: Response) {
  res.status(201).json({ usuario: await personal.crearUsuario(negocioDe(req), e.esquemaCrearUsuario.parse(req.body)) });
}
export async function editarUsuario(req: Request, res: Response) {
  res.json({ usuario: await personal.editarUsuario(sesionDe(req), idDe(req), e.esquemaEditarUsuario.parse(req.body)) });
}
export async function cambiarPassword(req: Request, res: Response) {
  await personal.cambiarPassword(negocioDe(req), idDe(req), e.esquemaPassword.parse(req.body).password);
  res.status(204).end();
}

// ---------- Mesas ----------

export async function verMesas(req: Request, res: Response) {
  res.json({ mesas: await local.listarMesas(negocioDe(req)) });
}
export async function crearMesa(req: Request, res: Response) {
  res.status(201).json(await local.crearMesa(negocioDe(req), e.esquemaMesa.parse(req.body).nombre));
}
export async function editarMesa(req: Request, res: Response) {
  await local.editarMesa(negocioDe(req), idDe(req), e.esquemaEditarMesa.parse(req.body));
  res.status(204).end();
}
export async function eliminarMesa(req: Request, res: Response) {
  await local.eliminarMesa(negocioDe(req), idDe(req));
  res.status(204).end();
}
export async function moverMesa(req: Request, res: Response) {
  await local.moverMesa(negocioDe(req), idDe(req), direccionDe(req));
  res.status(204).end();
}

// ---------- Motorizados ----------

export async function verRepartidores(req: Request, res: Response) {
  res.json({ repartidores: await local.listarRepartidores(negocioDe(req)) });
}
export async function crearRepartidor(req: Request, res: Response) {
  res.status(201).json(await local.crearRepartidor(negocioDe(req), e.esquemaRepartidor.parse(req.body)));
}
export async function editarRepartidor(req: Request, res: Response) {
  await local.editarRepartidor(negocioDe(req), idDe(req), e.esquemaEditarRepartidor.parse(req.body));
  res.status(204).end();
}
export async function eliminarRepartidor(req: Request, res: Response) {
  await local.eliminarRepartidor(negocioDe(req), idDe(req));
  res.status(204).end();
}

// ---------- Notas rápidas ----------

export async function verNotas(req: Request, res: Response) {
  res.json({ notas: await local.listarNotas(negocioDe(req)) });
}
export async function crearNota(req: Request, res: Response) {
  res.status(201).json(await local.crearNota(negocioDe(req), e.esquemaNota.parse(req.body).texto));
}
export async function editarNota(req: Request, res: Response) {
  await local.editarNota(negocioDe(req), idDe(req), e.esquemaEditarNota.parse(req.body));
  res.status(204).end();
}
export async function eliminarNota(req: Request, res: Response) {
  await local.eliminarNota(negocioDe(req), idDe(req));
  res.status(204).end();
}
export async function moverNota(req: Request, res: Response) {
  await local.moverNota(negocioDe(req), idDe(req), direccionDe(req));
  res.status(204).end();
}

// ---------- Negocio ----------

export async function verNegocio(req: Request, res: Response) {
  res.json({ negocio: await negocio.obtenerNegocio(negocioDe(req)) });
}
export async function editarNegocio(req: Request, res: Response) {
  res.json({ negocio: await negocio.editarNegocio(negocioDe(req), e.esquemaNegocio.parse(req.body)) });
}
// El cuerpo es la imagen tal cual (express.raw en la ruta)
export async function subirLogo(req: Request, res: Response) {
  if (!Buffer.isBuffer(req.body)) throw solicitudInvalida("El logo tiene que ser una imagen PNG, JPG o WebP");
  res.json({ negocio: await negocio.subirLogo(negocioDe(req), req.body) });
}
export async function quitarLogo(req: Request, res: Response) {
  res.json({ negocio: await negocio.quitarLogo(negocioDe(req)) });
}

// ---------- Reportes ----------

export async function verReporte(req: Request, res: Response) {
  res.json(await reportes.reporte(negocioDe(req), e.esquemaRango.parse(req.query)));
}
