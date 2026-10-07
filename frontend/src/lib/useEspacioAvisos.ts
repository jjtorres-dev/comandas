import { useCallback } from "react";

// Para la barra fija de abajo de cada pantalla (navegación, barra del pedido):
// publica su alto en --aviso-abajo y los avisos (sonner) salen justo encima,
// sin tapar ningún control.
export function useEspacioAvisos() {
  return useCallback((barra: HTMLElement | null) => {
    if (!barra) return;
    const raiz = document.documentElement;
    const fijar = () => raiz.style.setProperty("--aviso-abajo", `${barra.offsetHeight + 12}px`);
    fijar();
    const observador = new ResizeObserver(fijar);
    observador.observe(barra);
    return () => {
      observador.disconnect();
      raiz.style.removeProperty("--aviso-abajo");
    };
  }, []);
}
