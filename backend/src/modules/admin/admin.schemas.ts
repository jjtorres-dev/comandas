import { z } from "zod";
import { MetodoPago, Prisma, Rol } from "../../generated/prisma/client";
import { esquemaTelefono } from "../../lib/telefono";

const nombre = (max = 80) => z.string().trim().min(1, "Escribe un nombre").max(max);
const precio = z
  .number()
  .min(0)
  .max(9999)
  .multipleOf(0.01)
  .transform((n) => new Prisma.Decimal(n));

export const esquemaId = z.object({ id: z.uuid() });
export const esquemaMover = z.object({ direccion: z.enum(["subir", "bajar"]) });

// ---------- Carta ----------

export const esquemaCategoria = z.object({ nombre: nombre() });
export const esquemaEditarCategoria = z
  .object({ nombre: nombre().optional(), activo: z.boolean().optional() })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "No hay nada que cambiar" });

const esquemaVariante = z.object({
  // Con id se edita una variante existente; sin id se crea
  id: z.uuid().optional(),
  // Con una sola variante el nombre no importa: se guarda como "Única"
  nombre: z.string().trim().max(60).default(""),
  precio,
});

const camposDeProducto = {
  nombre: nombre(100),
  categoriaId: z.uuid(),
  areaId: z.uuid(),
  // Tapers que ocupa una unidad en delivery o para llevar (0 = bebidas)
  tapers: z.number().int().min(0).max(10),
  variantes: z.array(esquemaVariante).min(1, "Un plato necesita al menos un precio").max(12),
  esCombo: z.boolean(),
  // Solo combos: cuántos platos se eligen y entre cuáles
  comboCantidad: z.number().int().min(2).max(6).nullable(),
  opcionesCombo: z.array(z.uuid()).max(40),
};

const revisarProducto = (
  d: { variantes?: { nombre: string }[]; esCombo?: boolean; comboCantidad?: number | null; opcionesCombo?: string[] },
  ctx: z.RefinementCtx,
) => {
  const falta = (campo: string, mensaje: string) => ctx.addIssue({ code: "custom", path: [campo], message: mensaje });
  if (d.variantes && d.variantes.length > 1) {
    if (d.variantes.some((v) => !v.nombre)) falta("variantes", "Con varios precios, cada uno necesita un nombre");
    const nombres = d.variantes.map((v) => v.nombre.toLowerCase());
    if (new Set(nombres).size !== nombres.length) falta("variantes", "Hay dos precios con el mismo nombre");
  }
  if (d.esCombo) {
    if (!d.comboCantidad) falta("comboCantidad", "Indica cuántos platos se eligen en el combo");
    if (!d.opcionesCombo || d.opcionesCombo.length === 0) falta("opcionesCombo", "Marca al menos un plato que se pueda elegir");
    if (d.variantes && d.variantes.length > 1) falta("variantes", "Un combo tiene un solo precio");
  }
};

export const esquemaCrearProducto = z.object(camposDeProducto).superRefine(revisarProducto);
export const esquemaEditarProducto = z
  .object({ ...camposDeProducto, activo: z.boolean() })
  .partial()
  .superRefine(revisarProducto);
export const esquemaPrecio = z.object({ precio });

// ---------- Personal ----------

const usuario = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,30}$/, "El usuario lleva de 3 a 30 letras o números, sin espacios");
const password = z.string().min(6, "La contraseña necesita al menos 6 caracteres").max(72);
const roles = z.array(z.enum(Rol)).min(1, "Marca al menos un puesto").transform((r) => [...new Set(r)]);

export const esquemaCrearUsuario = z.object({ nombre: nombre(), usuario, password, roles });
export const esquemaEditarUsuario = z
  .object({ nombre: nombre().optional(), usuario: usuario.optional(), roles: roles.optional(), activo: z.boolean().optional() })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "No hay nada que cambiar" });
export const esquemaPassword = z.object({ password });

// ---------- Local ----------

export const esquemaMesa = z.object({ nombre: nombre(40) });
export const esquemaEditarMesa = z
  .object({ nombre: nombre(40).optional(), activo: z.boolean().optional() })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "No hay nada que cambiar" });

// "" o null quitan el celular
const telefonoOpcional = z.union([esquemaTelefono, z.literal("").transform(() => null), z.null()]);
export const esquemaRepartidor = z.object({ nombre: nombre(), telefono: telefonoOpcional.optional() });
export const esquemaEditarRepartidor = z
  .object({ nombre: nombre().optional(), telefono: telefonoOpcional.optional(), activo: z.boolean().optional() })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "No hay nada que cambiar" });

export const esquemaNota = z.object({ texto: nombre(60) });
export const esquemaEditarNota = z
  .object({ texto: nombre(60).optional(), activo: z.boolean().optional() })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "No hay nada que cambiar" });

// ---------- Negocio ----------

const monto = (max: number) =>
  z
    .number()
    .min(0)
    .max(max)
    .multipleOf(0.01)
    .transform((n) => new Prisma.Decimal(n));

export const esquemaNegocio = z
  .object({
    nombre: nombre(100).optional(),
    costoEnvioDefault: monto(20).optional(),
    precioTaper: monto(20).optional(),
    region: z.string().trim().max(100).nullable().optional(),
    // El primero es el distrito por defecto
    distritos: z
      .array(nombre(60))
      .max(30)
      .refine((d) => new Set(d.map((x) => x.toLowerCase())).size === d.length, "Hay distritos repetidos")
      .optional(),
    umbralTardaMin: z.number().int().min(1).max(240).optional(),
    umbralMuyTardeMin: z.number().int().min(1).max(240).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "No hay nada que cambiar" });

// ---------- Reportes ----------

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha va como AAAA-MM-DD");
// Días completos en la hora del negocio, los dos incluidos. Un año como máximo.
export const esquemaRango = z
  .object({ desde: fecha, hasta: fecha })
  .refine((r) => r.desde <= r.hasta, { message: "El rango empieza después de donde termina" })
  .refine((r) => (Date.parse(r.hasta) - Date.parse(r.desde)) / 86_400_000 <= 366, { message: "El rango no puede pasar de un año" });

export type DatosCrearProducto = z.infer<typeof esquemaCrearProducto>;
export type DatosEditarProducto = z.infer<typeof esquemaEditarProducto>;
export type DatosCrearUsuario = z.infer<typeof esquemaCrearUsuario>;
export type DatosEditarUsuario = z.infer<typeof esquemaEditarUsuario>;
export type DatosNegocio = z.infer<typeof esquemaNegocio>;
export type Rango = z.infer<typeof esquemaRango>;
export type { MetodoPago };
