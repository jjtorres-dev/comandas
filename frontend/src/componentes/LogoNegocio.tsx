import { useState } from "react";
import { urlDeArchivo } from "../lib/api";

type Props = {
  nombre: string;
  logoUrl: string | null;
  // Clases de tamaño del plato, p. ej. "size-11"
  className?: string;
  // El logo llena el plato casi hasta el borde (login); por defecto deja margen
  amplio?: boolean;
};

// Iniciales para cuando el negocio no tiene logo o la imagen no carga
function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/).filter(Boolean);
  return (palabras.length > 1 ? palabras[0][0] + palabras[palabras.length - 1][0] : nombre.slice(0, 2)).toUpperCase();
}

// El logo viene de la API y puede tener cualquier forma y color: se sirve
// siempre sobre un plato blanco para que se lea sobre el turquesa.
export function LogoNegocio({ nombre, logoUrl, className = "size-11", amplio = false }: Props) {
  const [fallo, setFallo] = useState<string | null>(null);
  const mostrarImagen = logoUrl !== null && fallo !== logoUrl;

  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-superficie shadow-plato ${className}`}
      style={{ containerType: "inline-size" }}
    >
      {mostrarImagen ? (
        <img
          src={urlDeArchivo(logoUrl)}
          alt={`Logo de ${nombre}`}
          className={`object-contain ${amplio ? "size-full" : "size-[88%]"}`}
          onError={() => setFallo(logoUrl)}
        />
      ) : (
        <span aria-hidden="true" className="font-bold text-marino" style={{ fontSize: "38cqw" }}>
          {iniciales(nombre)}
        </span>
      )}
    </span>
  );
}
