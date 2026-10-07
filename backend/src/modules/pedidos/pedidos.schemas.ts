import { z } from "zod";
import { EstadoItem, EstadoPedido, TipoPedido } from "../../generated/prisma/client";
import { esquemaMonto } from "../../lib/dinero";
import { esquemaTelefono } from "../../lib/telefono";

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
  referencia: textoOpcional(200),
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

export const esquemaRepartidor = z.object({ repartidorId: z.uuid().nullable() });

export const esquemaEstadoPedido = z.object({
  estado: z.enum([EstadoPedido.EN_CAMINO, EstadoPedido.ENTREGADO]),
});

export const esquemaFiltroActivos = z.object({ areaId: z.uuid().optional() });

export const esquemaParamsPedido = z.object({ id: z.uuid() });
export const esquemaParamsItem = z.object({ id: z.uuid(), itemId: z.uuid() });

export type ItemEntrada = z.infer<typeof esquemaItem>;
export type DatosCrearPedido = z.infer<typeof esquemaCrearPedido>;
export type DatosAgregarItems = z.infer<typeof esquemaAgregarItems>;
export type DatosCambiarEstado = z.infer<typeof esquemaCambiarEstado>;
export type DatosCargos = z.infer<typeof esquemaCargos>;
