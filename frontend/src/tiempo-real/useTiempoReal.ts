import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "sonner";
import { URL_SERVIDOR } from "../lib/api";
import { claves } from "../lib/consultas";
import type { EstadoConexion } from "./contexto";

// Conecta el Socket.IO con el token, reconecta solo y mantiene al día las
// consultas de TanStack: cada evento invalida lo que cambió en el servidor.
export function useTiempoReal(token: string | null, alPerderSesion: () => void): EstadoConexion {
  const consultas = useQueryClient();
  const [estado, setEstado] = useState<EstadoConexion>("reconectando");

  useEffect(() => {
    if (!token) return;

    const socket = io(URL_SERVIDOR || undefined, {
      auth: { token },
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    let yaConecto = false;

    const invalidarPedidos = () => {
      // Las mesas no tienen evento propio: cambian con los pedidos
      void consultas.invalidateQueries({ queryKey: claves.pedidos });
      void consultas.invalidateQueries({ queryKey: claves.mesas });
    };
    const invalidarCaja = () => {
      void consultas.invalidateQueries({ queryKey: claves.caja });
      void consultas.invalidateQueries({ queryKey: claves.reportes });
    };
    // El dueño cambió la carta, las mesas, los motorizados o los datos del negocio
    const invalidarCarta = () => {
      for (const clave of [claves.carta, claves.mesas, claves.repartidores, claves.admin, ["sesion"]]) {
        void consultas.invalidateQueries({ queryKey: clave });
      }
    };

    socket.on("connect", () => {
      setEstado("en-linea");
      // Los eventos emitidos durante un corte no se reenvían: hay que volver a pedir todo
      if (yaConecto) {
        invalidarPedidos();
        invalidarCaja();
        invalidarCarta();
      }
      yaConecto = true;
    });
    socket.on("disconnect", () => setEstado("reconectando"));
    socket.on("connect_error", (error) => {
      setEstado("reconectando");
      // El servidor rechazó el token: no tiene sentido seguir reintentando
      if (error.message === "No autenticado") {
        socket.disconnect();
        toast.error("Tu sesión ya no es válida. Vuelve a iniciar sesión", { id: "sesion-perdida" });
        alPerderSesion();
      }
    });

    // El socket tarda en notar un corte (hasta 45 s, por su latido). El
    // navegador lo sabe al instante: el indicador no espera.
    const alCortarse = () => setEstado("reconectando");
    const alVolver = () => {
      if (!socket.connected) return void socket.connect();
      setEstado("en-linea");
      // El socket nunca notó el corte: los eventos de ese rato se perdieron igual
      invalidarPedidos();
      invalidarCaja();
      invalidarCarta();
    };
    window.addEventListener("offline", alCortarse);
    window.addEventListener("online", alVolver);

    socket.on("pedido:creado", invalidarPedidos);
    socket.on("pedido:actualizado", invalidarPedidos);
    socket.on("caja:actualizada", invalidarCaja);
    socket.on("carta:actualizada", invalidarCarta);

    return () => {
      window.removeEventListener("offline", alCortarse);
      window.removeEventListener("online", alVolver);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [token, consultas, alPerderSesion]);

  return estado;
}
