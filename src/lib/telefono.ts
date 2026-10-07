import { z } from "zod";

const PREFIJO_PERU = "51";

// Deja solo dígitos y quita el prefijo del país: "+51 987 654 321" -> "987654321"
export function normalizarTelefono(telefono: string): string {
  const digitos = telefono.replace(/\D/g, "");
  return digitos.length === 11 && digitos.startsWith(PREFIJO_PERU) ? digitos.slice(2) : digitos;
}

export const esquemaTelefono = z
  .string()
  .transform(normalizarTelefono)
  .pipe(z.string().regex(/^\d{6,15}$/, "El teléfono debe tener entre 6 y 15 dígitos"));

// Enlace de WhatsApp con el mensaje ya escrito
export const enlaceWhatsapp = (telefono: string, texto: string): string =>
  `https://wa.me/${PREFIJO_PERU}${telefono}?text=${encodeURIComponent(texto)}`;
