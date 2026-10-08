import { emitirANegocio } from "../../realtime/socket";

// Avisa a todos los equipos del negocio que la carta o los datos del local
// cambiaron: los celulares de los mozos y /local vuelven a pedirlos
export const avisarCambio = (negocioId: string) => emitirANegocio(negocioId, "carta:actualizada", {});

// Sube o baja un elemento dentro de una lista ya ordenada. Devuelve el orden
// nuevo de todos (1, 2, 3…), o null si ya estaba en el extremo.
export function mover<T extends { id: string }>(lista: T[], id: string, direccion: "subir" | "bajar"): { id: string; orden: number }[] | null {
  const indice = lista.findIndex((x) => x.id === id);
  const destino = direccion === "subir" ? indice - 1 : indice + 1;
  if (indice === -1 || destino < 0 || destino >= lista.length) return null;
  const nueva = [...lista];
  [nueva[indice], nueva[destino]] = [nueva[destino], nueva[indice]];
  return nueva.map((x, i) => ({ id: x.id, orden: i + 1 }));
}
