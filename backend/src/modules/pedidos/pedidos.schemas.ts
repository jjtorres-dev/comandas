import { z } from "zod";
import { EstadoItem, EstadoPedido, MetodoPago, MomentoPago, Prisma, TipoPedido } from "../../generated/prisma/client.js";
import { esquemaMonto } from "../../lib/dinero.js";
import { esquemaTelefono } from "../../lib/telefono.js";

export const COSTO_ENVIO_MAXIMO = 20;

// Texto opcional de formulario: recorta espacios y trata "" como ausente
const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

const esquemaItem = z.object({
  varianteId: z.uuid(),
  cantidad: z.number().int().min(1).max(99),
  notas: z.array(z.string().trim().min(1).max(100)).max(10).default([]),
  // Solo combos: productoId de cada plato elegido (se permite repetir)
  componentes: z.array(z.uuid()).max(10).optional(),
});

const esquemaItems = z.array(esquemaItem).min(1).max(100);

const esquemaCliente = z.object({
  telefono: esquemaTelefono.optional(),
  nombre: textoOpcional(100),
  direccion: textoOpcional(200),
  // Uno de los distritos del negocio. Si falta en un delivery, se usa el primero
  distrito: textoOpcional(100),
  referencia: textoOpcional(200),
});

// Lo que el motorizado necesita saber: si ya está pagado (por confirmar) o si
// cobra al entregar, cómo y con cuánto le van a pagar
export const esquemaPagoPrevisto = z
  .object({
    momento: z.enum(MomentoPago),
    metodo: z.enum(MetodoPago),
    // Solo AL_RECIBIR en EFECTIVO: con cuánto paga el cliente
    pagaCon: z
      .number()
      .positive()
      .max(99_999)
      .multipleOf(0.01)
      .transform((n) => new Prisma.Decimal(n))
      .optional(),
  })
  .superRefine((pago, ctx) => {
    if (pago.momento === MomentoPago.ANTICIPADO && pago.metodo !== MetodoPago.YAPE && pago.metodo !== MetodoPago.PLIN) {
      ctx.addIssue({ code: "custom", path: ["metodo"], message: "Un pago anticipado solo puede ser por Yape o Plin" });
    }
    if (pago.pagaCon !== undefined && !(pago.momento === MomentoPago.AL_RECIBIR && pago.metodo === MetodoPago.EFECTIVO)) {
      ctx.addIssue({ code: "custom", path: ["pagaCon"], message: "pagaCon solo aplica al efectivo que se paga al recibir" });
    }
  });

const esquemaCostoEnvio = esquemaMonto(COSTO_ENVIO_MAXIMO);
const esquemaTapers = z.number().int().min(0).max(200);

export const esquemaCrearPedido = z
  .object({
    tipo: z.enum(TipoPedido),
    mesaId: z.uuid().nullish(),
    items: esquemaItems,
    nota: textoOpcional(500),
    // UUID generado por el cliente: hace que reintentar no duplique el pedido
    idCliente: z.uuid(),
    // DELIVERY (obligatorio, con teléfono y dirección) y PARA_LLEVAR (opcional)
    cliente: esquemaCliente.optional(),
    // Solo DELIVERY. Si falta se usa Negocio.costoEnvioDefault
    costoEnvio: esquemaCostoEnvio.optional(),
    // DELIVERY y PARA_LLEVAR: cómo va a pagar. Se ignora en MESA
    pagoPrevisto: esquemaPagoPrevisto.optional(),
    // DELIVERY y PARA_LLEVAR. Si falta se calcula con los items (cantidad × Producto.tapers)
    // y se recalcula sola; si viene, queda fija (tapersManual)
    cantidadTapers: esquemaTapers.optional(),
  })
  .superRefine((datos, ctx) => {
    const falta = (campo: (string | number)[], mensaje: string) =>
      ctx.addIssue({ code: "custom", path: campo, message: mensaje });

    if (datos.tipo === TipoPedido.MESA && !datos.mesaId) falta(["mesaId"], "Un pedido de mesa necesita mesaId");
    if (datos.tipo !== TipoPedido.MESA && datos.mesaId) falta(["mesaId"], "Solo los pedidos de mesa llevan mesaId");
    if (datos.tipo === TipoPedido.DELIVERY) {
      if (!datos.cliente?.telefono) falta(["cliente", "telefono"], "Un delivery necesita el teléfono del cliente");
      if (!datos.cliente?.direccion) falta(["cliente", "direccion"], "Un delivery necesita la dirección de entrega");
    }
  });

export const esquemaAgregarItems = z.object({
  // UUID generado por el cliente para esta ronda: reintentar no la duplica
  idRonda: z.uuid(),
  items: esquemaItems,
  // Nota general de esta ronda: se suma a la nota del pedido, no la reemplaza
  nota: textoOpcional(500),
});

// CANCELADO no entra aquí: cancelar tiene su propia ruta y sus propias reglas
export const esquemaCambiarEstado = z
  .object({
    itemIds: z.array(z.uuid()).min(1).max(100).optional(),
    areaId: z.uuid().optional(),
    estado: z.enum([
      EstadoItem.PENDIENTE,
      EstadoItem.PREPARANDO,
      EstadoItem.LISTO,
      EstadoItem.ENTREGADO,
    ]),
  })
  .refine((d) => (d.itemIds === undefined) !== (d.areaId === undefined), {
    message: "Envía itemIds o areaId (uno de los dos, no ambos)",
  });

export const esquemaCargos = z
  .object({
    costoEnvio: esquemaCostoEnvio.optional(),
    // Un número fija la cantidad (tapersManual); null vuelve al cálculo automático
    cantidadTapers: esquemaTapers.nullable().optional(),
    descuento: esquemaMonto(99_999).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "Envía al menos uno: costoEnvio, cantidadTapers o descuento",
  });

// Correcciones a un pedido por teléfono ya enviado: lo que no se envía no cambia
export const esquemaEntrega = z
  .object({
    nombre: textoOpcional(100),
    direccion: textoOpcional(200),
    distrito: textoOpcional(100),
    // null o "" borran la referencia
    referencia: z.string().trim().max(200).nullable().optional(),
    pagoPrevisto: esquemaPagoPrevisto.optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "Envía al menos un dato para corregir",
  });

export const esquemaCancelarPedido = z.object({
  motivo: z.string().trim().min(3, "Escribe el motivo de la cancelación").max(200),
});

export const esquemaRepartidor = z.object({ repartidorId: z.uuid().nullable() });

// EN_CAMINO y ENTREGADO despachan; LISTO (y EN_CAMINO desde ENTREGADO) deshacen el paso anterior
export const esquemaEstadoPedido = z.object({
  estado: z.enum([EstadoPedido.EN_CAMINO, EstadoPedido.ENTREGADO, EstadoPedido.LISTO]),
});

export const esquemaFiltroActivos = z.object({ areaId: z.uuid().optional() });

export const esquemaParamsPedido = z.object({ id: z.uuid() });
export const esquemaParamsItem = z.object({ id: z.uuid(), itemId: z.uuid() });

export type ItemEntrada = z.infer<typeof esquemaItem>;
export type DatosEntrega = z.infer<typeof esquemaEntrega>;
export type DatosPagoPrevisto = z.infer<typeof esquemaPagoPrevisto>;
export type DatosCrearPedido = z.infer<typeof esquemaCrearPedido>;
export type DatosAgregarItems = z.infer<typeof esquemaAgregarItems>;
export type DatosCambiarEstado = z.infer<typeof esquemaCambiarEstado>;
export type DatosCargos = z.infer<typeof esquemaCargos>;
