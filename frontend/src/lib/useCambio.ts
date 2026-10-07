import { useState } from "react";

// true si el valor cambió desde que el componente está en pantalla. Las
// animaciones de feedback lo usan para no dispararse al abrir una pantalla:
// solo responden a algo que acaba de pasar.
export function useCambio<T>(valor: T): boolean {
  const [previo, setPrevio] = useState(valor);
  const [cambio, setCambio] = useState(false);
  if (valor !== previo) {
    setPrevio(valor);
    setCambio(true);
  }
  return cambio;
}
