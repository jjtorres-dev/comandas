// Mesas, motorizados y notas rápidas. Lo que tiene historial se desactiva;
// lo que nunca se usó se puede eliminar.
import { conflicto, noEncontrado } from "../../lib/errores.js";
import { prisma } from "../../lib/prisma.js";
import { avisarCambio, mover } from "./comun.js";

const porOrden = [{ orden: "asc" as const }, { nombre: "asc" as const }];

// ---------- Mesas ----------

export async function listarMesas(negocioId: string) {
  const mesas = await prisma.mesa.findMany({ where: { negocioId }, orderBy: porOrden, include: { _count: { select: { pedidos: true } } } });
  return mesas.map((m) => ({ id: m.id, nombre: m.nombre, activo: m.activo, eliminable: m._count.pedidos === 0 }));
}

const mesaDe = async (negocioId: string, id: string) => {
  const mesa = await prisma.mesa.findFirst({ where: { id, negocioId } });
  if (!mesa) throw noEncontrado("La mesa no existe");
  return mesa;
};

export async function crearMesa(negocioId: string, nombre: string) {
  const ultima = await prisma.mesa.aggregate({ where: { negocioId }, _max: { orden: true } });
  const mesa = await prisma.mesa.create({ data: { negocioId, nombre, orden: (ultima._max.orden ?? 0) + 1 } });
  avisarCambio(negocioId);
  return { id: mesa.id };
}

export async function editarMesa(negocioId: string, id: string, datos: { nombre?: string; activo?: boolean }) {
  await mesaDe(negocioId, id);
  // Una mesa con un pedido abierto no se retira: primero hay que cobrarlo
  if (datos.activo === false && (await prisma.pedido.count({ where: { mesaId: id, pagado: false, mesaLiberada: false, estado: { not: "CANCELADO" } } })) > 0) {
    throw conflicto("MESA_OCUPADA", "Esa mesa tiene un pedido abierto. Cóbralo antes de desactivarla");
  }
  await prisma.mesa.update({ where: { id }, data: datos });
  avisarCambio(negocioId);
}

export async function eliminarMesa(negocioId: string, id: string) {
  await mesaDe(negocioId, id);
  if ((await prisma.pedido.count({ where: { mesaId: id } })) > 0) {
    throw conflicto("CON_HISTORIAL", "Esta mesa ya tuvo pedidos: no se puede eliminar, solo desactivar");
  }
  await prisma.mesa.delete({ where: { id } });
  avisarCambio(negocioId);
}

export async function moverMesa(negocioId: string, id: string, direccion: "subir" | "bajar") {
  await mesaDe(negocioId, id);
  const orden = mover(await prisma.mesa.findMany({ where: { negocioId }, orderBy: porOrden, select: { id: true } }), id, direccion);
  if (orden) await prisma.$transaction(orden.map((f) => prisma.mesa.update({ where: { id: f.id }, data: { orden: f.orden } })));
  avisarCambio(negocioId);
}

// ---------- Motorizados ----------

export async function listarRepartidores(negocioId: string) {
  const lista = await prisma.repartidor.findMany({ where: { negocioId }, orderBy: [{ activo: "desc" }, { nombre: "asc" }], include: { _count: { select: { pedidos: true } } } });
  return lista.map((r) => ({ id: r.id, nombre: r.nombre, telefono: r.telefono, activo: r.activo, eliminable: r._count.pedidos === 0 }));
}

const repartidorDe = async (negocioId: string, id: string) => {
  const repartidor = await prisma.repartidor.findFirst({ where: { id, negocioId } });
  if (!repartidor) throw noEncontrado("Ese motorizado no existe");
  return repartidor;
};

export async function crearRepartidor(negocioId: string, datos: { nombre: string; telefono?: string | null }) {
  const repartidor = await prisma.repartidor.create({ data: { negocioId, nombre: datos.nombre, telefono: datos.telefono ?? null } });
  avisarCambio(negocioId);
  return { id: repartidor.id };
}

export async function editarRepartidor(negocioId: string, id: string, datos: { nombre?: string; telefono?: string | null; activo?: boolean }) {
  await repartidorDe(negocioId, id);
  await prisma.repartidor.update({ where: { id }, data: datos });
  avisarCambio(negocioId);
}

export async function eliminarRepartidor(negocioId: string, id: string) {
  await repartidorDe(negocioId, id);
  if ((await prisma.pedido.count({ where: { repartidorId: id } })) > 0) {
    throw conflicto("CON_HISTORIAL", "Este motorizado ya llevó pedidos: no se puede eliminar, solo desactivar");
  }
  await prisma.repartidor.delete({ where: { id } });
  avisarCambio(negocioId);
}

// ---------- Notas rápidas ----------

const notasPorOrden = [{ orden: "asc" as const }, { texto: "asc" as const }];

export async function listarNotas(negocioId: string) {
  const notas = await prisma.notaRapida.findMany({ where: { negocioId }, orderBy: notasPorOrden });
  // Una nota es solo un texto que se copia al pedido: siempre se puede eliminar
  return notas.map((n) => ({ id: n.id, texto: n.texto, activo: n.activo, eliminable: true }));
}

const notaDe = async (negocioId: string, id: string) => {
  const nota = await prisma.notaRapida.findFirst({ where: { id, negocioId } });
  if (!nota) throw noEncontrado("Esa nota no existe");
  return nota;
};

export async function crearNota(negocioId: string, texto: string) {
  const ultima = await prisma.notaRapida.aggregate({ where: { negocioId }, _max: { orden: true } });
  const nota = await prisma.notaRapida.create({ data: { negocioId, texto, orden: (ultima._max.orden ?? 0) + 1 } });
  avisarCambio(negocioId);
  return { id: nota.id };
}

export async function editarNota(negocioId: string, id: string, datos: { texto?: string; activo?: boolean }) {
  await notaDe(negocioId, id);
  await prisma.notaRapida.update({ where: { id }, data: datos });
  avisarCambio(negocioId);
}

export async function eliminarNota(negocioId: string, id: string) {
  await notaDe(negocioId, id);
  await prisma.notaRapida.delete({ where: { id } });
  avisarCambio(negocioId);
}

export async function moverNota(negocioId: string, id: string, direccion: "subir" | "bajar") {
  await notaDe(negocioId, id);
  const orden = mover(await prisma.notaRapida.findMany({ where: { negocioId }, orderBy: notasPorOrden, select: { id: true } }), id, direccion);
  if (orden) await prisma.$transaction(orden.map((f) => prisma.notaRapida.update({ where: { id: f.id }, data: { orden: f.orden } })));
  avisarCambio(negocioId);
}
