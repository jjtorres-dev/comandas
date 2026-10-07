import { EstadoItem, EstadoPedido, Prisma, Rol, TipoPedido } from "../../generated/prisma/client";
import { CERO } from "../../lib/dinero";
import { conflicto, noEncontrado, sinPermiso, solicitudInvalida } from "../../lib/errores";
import { prisma, type Tx } from "../../lib/prisma";
import { inicioDelDia } from "../../lib/tiempo";
import type { Sesion } from "../../middlewares/auth";
import {
  bloquearNegocio,
  bloquearPedido,
  exigirNoCancelado,
  incluirCompleto,
  obtenerCompleto,
  publicar,
  recalcular,
  recalcularTapers,
  serializar,
  type PedidoSerializado,
} from "./pedidos.core";
import type {
  DatosAgregarItems,
  DatosCambiarEstado,
  DatosCargos,
  DatosCrearPedido,
  ItemEntrada,
} from "./pedidos.schemas";

const VARIANTE_UNICA = "Única";

// ---------- REGLAS ----------

// Convierte lo que envía el cliente en filas de PedidoItem. Precios y nombres
// salen SIEMPRE de la base; del cliente solo se aceptan ids, cantidades y notas.
async function prepararItems(tx: Tx, negocioId: string, items: ItemEntrada[]) {
  const variantes = await tx.varianteProducto.findMany({
    where: {
      id: { in: items.map((i) => i.varianteId) },
      activo: true,
      producto: { negocioId, activo: true },
    },
    include: {
      producto: {
        include: {
          opcionesCombo: {
            where: { producto: { negocioId, activo: true } },
            include: { producto: { select: { id: true, nombre: true } } },
          },
        },
      },
    },
  });
  const variantePorId = new Map(variantes.map((v) => [v.id, v]));

  const faltantes = items.map((i) => i.varianteId).filter((id) => !variantePorId.has(id));
  if (faltantes.length > 0) {
    throw solicitudInvalida("Hay productos que no existen o ya no están disponibles", {
      varianteIds: [...new Set(faltantes)],
    });
  }

  return items.map((item) => {
    const variante = variantePorId.get(item.varianteId)!;
    const { producto } = variante;
    const elegidos = item.componentes ?? [];
    let componentes: string[] = [];

    if (producto.esCombo) {
      if (elegidos.length !== producto.comboCantidad) {
        throw solicitudInvalida(
          `"${producto.nombre}" requiere elegir exactamente ${producto.comboCantidad} platos`,
        );
      }
      const nombrePorOpcion = new Map(producto.opcionesCombo.map((o) => [o.producto.id, o.producto.nombre]));
      componentes = elegidos.map((productoId) => {
        const nombre = nombrePorOpcion.get(productoId);
        if (!nombre) {
          throw solicitudInvalida(`"${producto.nombre}" incluye un plato que no es una de sus opciones`, {
            productoId,
          });
        }
        return nombre;
      });
    } else if (elegidos.length > 0) {
      throw solicitudInvalida(`"${producto.nombre}" no es un combo y no admite componentes`);
    }

    return {
      varianteId: variante.id,
      areaId: producto.areaId,
      cantidad: item.cantidad,
      nombreProducto:
        variante.nombre === VARIANTE_UNICA ? producto.nombre : `${producto.nombre} — ${variante.nombre}`,
      precioUnitario: variante.precio,
      notas: item.notas,
      componentes,
    };
  });
}

// Agrega una ronda al final de la comanda, respetando el orden en que llegó
async function insertarRonda(
  tx: Tx,
  pedidoId: string,
  idRonda: string,
  filas: Awaited<ReturnType<typeof prepararItems>>,
) {
  const ultimo = await tx.pedidoItem.aggregate({ where: { pedidoId }, _max: { orden: true } });
  const base = ultimo._max.orden ?? 0;
  await tx.pedidoItem.createMany({
    data: filas.map((fila, i) => ({ ...fila, pedidoId, idRonda, orden: base + i + 1 })),
  });
}

// Datos de entrega según el tipo. En MESA no hay cliente, envío ni tapers.
async function prepararEntrega(
  tx: Tx,
  negocio: { id: string; costoEnvioDefault: Prisma.Decimal; precioTaper: Prisma.Decimal },
  datos: DatosCrearPedido,
) {
  if (datos.tipo === TipoPedido.MESA) return {};

  const esDelivery = datos.tipo === TipoPedido.DELIVERY;
  const { telefono, nombre, direccion, referencia } = datos.cliente ?? {};

  // Con teléfono se guarda (o actualiza) el cliente para autocompletar la próxima vez
  let cliente = null;
  if (telefono) {
    const entrega = esDelivery ? { direccion, referencia: referencia ?? null } : {};
    cliente = await tx.cliente.upsert({
      where: { negocioId_telefono: { negocioId: negocio.id, telefono } },
      create: { negocioId: negocio.id, telefono, nombre, ...entrega },
      update: { ...(nombre ? { nombre } : {}), ...entrega },
    });
  }

  // Si la cantidad viene en el pedido queda fija; si no, se calcula con los items
  const tapers =
    datos.cantidadTapers === undefined
      ? {}
      : {
          tapersManual: true,
          cantidadTapers: datos.cantidadTapers,
          cargoTapers: negocio.precioTaper.times(datos.cantidadTapers),
        };

  return {
    clienteId: cliente?.id ?? null,
    nombreCliente: nombre ?? cliente?.nombre ?? null,
    telefonoCliente: telefono ?? null,
    // Copias: si el cliente se muda después, este pedido no cambia
    direccionEntrega: esDelivery ? direccion : null,
    referenciaEntrega: esDelivery ? (referencia ?? null) : null,
    costoEnvio: esDelivery ? (datos.costoEnvio ?? negocio.costoEnvioDefault) : CERO,
    ...tapers,
  };
}

// ---------- CASOS DE USO ----------

export async function crearPedido(
  sesion: Sesion,
  datos: DatosCrearPedido,
): Promise<{ pedido: PedidoSerializado; creado: boolean }> {
  const { negocioId } = sesion;

  const resultado = await prisma.$transaction(async (tx) => {
    const negocio = await bloquearNegocio(tx, negocioId);

    // Idempotencia: si el celular reintenta, se devuelve el pedido ya creado
    const existente = await tx.pedido.findUnique({
      where: { idCliente: datos.idCliente },
      include: incluirCompleto,
    });
    if (existente) {
      if (existente.negocioId !== negocioId) {
        throw conflicto("ID_CLIENTE_EN_USO", "El idCliente ya fue usado. Genera uno nuevo");
      }
      return { pedido: existente, creado: false };
    }

    if (datos.mesaId) {
      const mesa = await tx.mesa.findFirst({ where: { id: datos.mesaId, negocioId, activo: true } });
      if (!mesa) throw noEncontrado("La mesa no existe");

      const abierto = await tx.pedido.findFirst({
        where: { negocioId, mesaId: mesa.id, pagado: false, estado: { not: EstadoPedido.CANCELADO } },
        select: { id: true, numero: true },
      });
      if (abierto) {
        throw conflicto(
          "MESA_OCUPADA",
          `${mesa.nombre} ya tiene un pedido abierto. Agrega los items a ese pedido`,
          { pedidoId: abierto.id },
        );
      }
    }

    const filas = await prepararItems(tx, negocioId, datos.items);
    const entrega = await prepararEntrega(tx, negocio, datos);

    // Correlativo diario: reinicia a medianoche de America/Lima
    const ultimo = await tx.pedido.aggregate({
      where: { negocioId, creadoEn: { gte: inicioDelDia() } },
      _max: { numero: true },
    });

    const pedido = await tx.pedido.create({
      data: {
        negocioId,
        numero: (ultimo._max.numero ?? 0) + 1,
        tipo: datos.tipo,
        mesaId: datos.mesaId ?? null,
        mozoId: sesion.usuarioId,
        nota: datos.nota ?? null,
        idCliente: datos.idCliente,
        ...entrega,
      },
    });
    // La primera ronda se identifica con el idCliente del pedido
    await insertarRonda(tx, pedido.id, datos.idCliente, filas);
    await recalcularTapers(tx, pedido.id);
    await recalcular(tx, pedido.id);

    return { pedido: await obtenerCompleto(tx, pedido.id), creado: true };
  });

  return {
    pedido: resultado.creado ? publicar("pedido:creado", resultado.pedido) : serializar(resultado.pedido),
    creado: resultado.creado,
  };
}

// Nueva ronda sobre un pedido abierto (no pagado y no cancelado)
export async function agregarItems(
  sesion: Sesion,
  pedidoId: string,
  datos: DatosAgregarItems,
): Promise<{ pedido: PedidoSerializado; creado: boolean }> {
  const { negocioId } = sesion;

  const resultado = await prisma.$transaction(async (tx) => {
    const pedido = await bloquearPedido(tx, negocioId, pedidoId);

    // Idempotencia: si esta ronda ya entró, no se duplica
    const yaEntro = await tx.pedidoItem.count({ where: { pedidoId, idRonda: datos.idRonda } });
    if (yaEntro > 0) return { pedido: await obtenerCompleto(tx, pedidoId), creado: false };

    exigirNoCancelado(pedido);
    if (pedido.pagado) throw conflicto("PEDIDO_PAGADO", "El pedido ya está pagado. Crea un pedido nuevo");

    const filas = await prepararItems(tx, negocioId, datos.items);
    await insertarRonda(tx, pedidoId, datos.idRonda, filas);
    await recalcularTapers(tx, pedidoId);
    await recalcular(tx, pedidoId);

    return { pedido: await obtenerCompleto(tx, pedidoId), creado: true };
  });

  return {
    pedido: resultado.creado ? publicar("pedido:actualizado", resultado.pedido) : serializar(resultado.pedido),
    creado: resultado.creado,
  };
}

// Pedidos no pagados o no entregados, del más antiguo al más nuevo.
// Con areaId: solo pedidos con items de esa área, y solo esos items.
export async function listarActivos(negocioId: string, areaId?: string) {
  const pedidos = await prisma.pedido.findMany({
    where: {
      negocioId,
      estado: { not: EstadoPedido.CANCELADO },
      OR: [{ pagado: false }, { estado: { not: EstadoPedido.ENTREGADO } }],
      ...(areaId ? { items: { some: { areaId } } } : {}),
    },
    orderBy: [{ creadoEn: "asc" }, { numero: "asc" }],
    include: {
      ...incluirCompleto,
      items: { ...incluirCompleto.items, where: areaId ? { areaId } : undefined },
    },
  });

  return pedidos.map(serializar);
}

// Cambia varios items a la vez: por lista de ids o un área entera
export async function cambiarEstadoItems(sesion: Sesion, pedidoId: string, datos: DatosCambiarEstado) {
  const actualizado = await prisma.$transaction(async (tx) => {
    exigirNoCancelado(await bloquearPedido(tx, sesion.negocioId, pedidoId));

    if (datos.itemIds) {
      const ids = [...new Set(datos.itemIds)];
      const items = await tx.pedidoItem.findMany({ where: { pedidoId, id: { in: ids } } });
      if (items.length !== ids.length) throw noEncontrado("Hay items que no pertenecen a este pedido");
      if (items.some((i) => i.estado === EstadoItem.CANCELADO)) {
        throw conflicto("ITEM_CANCELADO", "No se puede cambiar el estado de un item cancelado");
      }
      await tx.pedidoItem.updateMany({ where: { pedidoId, id: { in: ids } }, data: { estado: datos.estado } });
    } else {
      const delArea = { pedidoId, areaId: datos.areaId, estado: { not: EstadoItem.CANCELADO } };
      if ((await tx.pedidoItem.count({ where: delArea })) === 0) {
        throw noEncontrado("El pedido no tiene items de esa área");
      }
      // Lo ya entregado no se toca: marcar el área no devuelve platos a la cocina
      await tx.pedidoItem.updateMany({
        where: { ...delArea, estado: { notIn: [EstadoItem.CANCELADO, EstadoItem.ENTREGADO] } },
        data: { estado: datos.estado },
      });
    }

    await recalcular(tx, pedidoId);
    return obtenerCompleto(tx, pedidoId);
  });

  return publicar("pedido:actualizado", actualizado);
}

// Solo items PENDIENTES, salvo que quien cancela sea ADMIN. Recalcula los totales.
export async function cancelarItem(sesion: Sesion, pedidoId: string, itemId: string) {
  const actualizado = await prisma.$transaction(async (tx) => {
    const pedido = await bloquearPedido(tx, sesion.negocioId, pedidoId);
    exigirNoCancelado(pedido);
    if (pedido.pagado) throw conflicto("PEDIDO_PAGADO", "No se puede cancelar items de un pedido ya pagado");

    const item = await tx.pedidoItem.findFirst({ where: { id: itemId, pedidoId } });
    if (!item) throw noEncontrado("El item no existe en este pedido");
    if (item.estado === EstadoItem.CANCELADO) throw conflicto("ITEM_CANCELADO", "El item ya está cancelado");
    if (item.estado !== EstadoItem.PENDIENTE && !sesion.roles.includes(Rol.ADMIN)) {
      throw sinPermiso("El item ya está en preparación: solo el administrador puede cancelarlo");
    }
    if ((await tx.pago.count({ where: { pedidoId, itemIds: { has: itemId } } })) > 0) {
      throw conflicto("ITEM_PAGADO", "El item ya fue cobrado y no se puede cancelar");
    }

    await tx.pedidoItem.update({ where: { id: itemId }, data: { estado: EstadoItem.CANCELADO } });
    await recalcularTapers(tx, pedidoId);
    await recalcular(tx, pedidoId);
    return obtenerCompleto(tx, pedidoId);
  });

  return publicar("pedido:actualizado", actualizado);
}

// Ajusta envío, tapers o descuento desde caja. Solo antes del primer pago.
export async function actualizarCargos(sesion: Sesion, pedidoId: string, datos: DatosCargos) {
  const actualizado = await prisma.$transaction(async (tx) => {
    const pedido = await bloquearPedido(tx, sesion.negocioId, pedidoId);
    exigirNoCancelado(pedido);
    if ((await tx.pago.count({ where: { pedidoId } })) > 0) {
      throw conflicto("PEDIDO_CON_PAGOS", "El pedido ya tiene pagos: no se pueden cambiar sus cargos");
    }
    if (datos.costoEnvio !== undefined && pedido.tipo !== TipoPedido.DELIVERY) {
      throw solicitudInvalida("Solo los pedidos de delivery tienen costo de envío");
    }
    if (datos.cantidadTapers !== undefined && pedido.tipo === TipoPedido.MESA) {
      throw solicitudInvalida("Los pedidos de mesa no llevan tapers");
    }

    // Tapers: un número fija la cantidad a mano; null vuelve al cálculo automático
    let tapers = {};
    if (datos.cantidadTapers === null) {
      tapers = { tapersManual: false };
    } else if (datos.cantidadTapers !== undefined) {
      const negocio = await tx.negocio.findUniqueOrThrow({ where: { id: sesion.negocioId } });
      tapers = {
        tapersManual: true,
        cantidadTapers: datos.cantidadTapers,
        cargoTapers: negocio.precioTaper.times(datos.cantidadTapers),
      };
    }

    await tx.pedido.update({
      where: { id: pedidoId },
      data: { costoEnvio: datos.costoEnvio, descuento: datos.descuento, ...tapers },
    });
    await recalcularTapers(tx, pedidoId);

    const nuevo = await tx.pedido.findUniqueOrThrow({ where: { id: pedidoId } });
    if (nuevo.descuento.greaterThan(nuevo.subtotal.plus(nuevo.costoEnvio).plus(nuevo.cargoTapers))) {
      throw solicitudInvalida("El descuento no puede ser mayor que el total del pedido");
    }

    await recalcular(tx, pedidoId);
    return obtenerCompleto(tx, pedidoId);
  });

  return publicar("pedido:actualizado", actualizado);
}

// Asigna (o quita, con null) el motorizado de un delivery
export async function asignarRepartidor(sesion: Sesion, pedidoId: string, repartidorId: string | null) {
  const { negocioId } = sesion;

  const actualizado = await prisma.$transaction(async (tx) => {
    const pedido = await bloquearPedido(tx, negocioId, pedidoId);
    exigirNoCancelado(pedido);
    if (pedido.tipo !== TipoPedido.DELIVERY) {
      throw conflicto("NO_ES_DELIVERY", "Solo los pedidos de delivery llevan repartidor");
    }
    if (repartidorId) {
      const repartidor = await tx.repartidor.findFirst({ where: { id: repartidorId, negocioId, activo: true } });
      if (!repartidor) throw noEncontrado("El repartidor no existe");
    }

    await tx.pedido.update({ where: { id: pedidoId }, data: { repartidorId } });
    return obtenerCompleto(tx, pedidoId);
  });

  return publicar("pedido:actualizado", actualizado);
}

// Despacho: EN_CAMINO (solo delivery que ya está LISTO) o ENTREGADO (todo el pedido)
export async function cambiarEstadoPedido(
  sesion: Sesion,
  pedidoId: string,
  estado: typeof EstadoPedido.EN_CAMINO | typeof EstadoPedido.ENTREGADO,
) {
  const actualizado = await prisma.$transaction(async (tx) => {
    const pedido = await bloquearPedido(tx, sesion.negocioId, pedidoId);
    exigirNoCancelado(pedido);

    if (estado === EstadoPedido.EN_CAMINO) {
      if (pedido.tipo !== TipoPedido.DELIVERY) {
        throw conflicto("NO_ES_DELIVERY", "Solo los pedidos de delivery salen en camino");
      }
      if (pedido.estado !== EstadoPedido.LISTO) {
        throw conflicto("PEDIDO_NO_LISTO", "El pedido tiene que estar LISTO para salir en camino");
      }
      await tx.pedido.update({ where: { id: pedidoId }, data: { estado } });
    } else {
      if (pedido.estado !== EstadoPedido.LISTO && pedido.estado !== EstadoPedido.EN_CAMINO) {
        throw conflicto("PEDIDO_NO_LISTO", "Todavía hay items sin terminar: no se puede marcar como entregado");
      }
      await tx.pedidoItem.updateMany({
        where: { pedidoId, estado: { not: EstadoItem.CANCELADO } },
        data: { estado: EstadoItem.ENTREGADO },
      });
      await recalcular(tx, pedidoId);
    }

    return obtenerCompleto(tx, pedidoId);
  });

  return publicar("pedido:actualizado", actualizado);
}
