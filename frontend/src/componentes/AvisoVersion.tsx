import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { registerSW } from "virtual:pwa-register";
import { useMozo } from "../mozo/almacen";

// Cada cuánto se pregunta al servidor si hay una versión nueva
const CADA = 15 * 60_000;
const ID = "version-nueva";

// La aplicación instalada (PWA) guarda sus archivos en el equipo. Cuando se
// despliega una versión nueva, se descarga en segundo plano y aquí se avisa:
// "Hay una versión nueva · Actualizar". Nunca se recarga sola: una recarga en
// plena toma de pedido la decide quien tiene el equipo en la mano.
export function AvisoVersion() {
  const { cola, borradores } = useMozo();
  const pendientes = cola.length + Object.keys(borradores).length;
  // Hay una versión descargada, esperando a que alguien toque "Actualizar"
  const [lista, setLista] = useState(false);
  const actualizar = useRef<(recargar?: boolean) => Promise<void>>(undefined);

  useEffect(() => {
    let reloj: ReturnType<typeof setInterval> | undefined;
    let revisar = () => {};

    actualizar.current = registerSW({
      onNeedRefresh: () => setLista(true),
      onRegisteredSW(_url, registro) {
        if (!registro) return;
        // Los equipos pasan el turno entero con la app abierta: sin esto no se enterarían hasta cerrarla
        revisar = () => {
          if (navigator.onLine && document.visibilityState === "visible") void registro.update().catch(() => {});
        };
        reloj = setInterval(revisar, CADA);
        document.addEventListener("visibilitychange", revisar);
      },
    });

    return () => {
      clearInterval(reloj);
      document.removeEventListener("visibilitychange", revisar);
    };
  }, []);

  useEffect(() => {
    if (!lista) return;
    toast("Hay una versión nueva", {
      id: ID,
      duration: Infinity,
      dismissible: false,
      // Con pedidos a medias, aclara que actualizar no los borra (borradores y
      // cola están guardados en el equipo)
      description: pendientes > 0 ? "Tus pedidos sin enviar se conservan al actualizar." : undefined,
      action: {
        label: "Actualizar",
        onClick: () => {
          // Activa la versión nueva y recarga. Si esta pestaña todavía no
          // dependía del service worker (primera visita), él no la recarga:
          // se recarga aquí, que ya trae lo nuevo
          void actualizar.current?.(true);
          setTimeout(() => window.location.reload(), 3000);
        },
      },
    });
  }, [lista, pendientes]);

  return null;
}
