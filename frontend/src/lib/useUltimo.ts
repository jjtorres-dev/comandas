import { useState } from "react";

// Recuerda el último valor no nulo. Sirve para que una hoja que se está
// cerrando siga mostrando su contenido mientras baja.
export function useUltimo<T>(valor: T | null | undefined): T | null {
  const [ultimo, setUltimo] = useState<T | null>(valor ?? null);
  if (valor != null && valor !== ultimo) setUltimo(valor);
  return valor ?? ultimo;
}
