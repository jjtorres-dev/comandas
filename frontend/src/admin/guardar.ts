import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { mensajeDe } from "../lib/api";
import { claves } from "../lib/consultas";

// Todo cambio de /admin pasa por aquí: lo envía, vuelve a pedir lo que cambió
// (también la carta y las mesas que usan los demás) y avisa si algo falló.
// Devuelve true si el servidor lo aceptó.
export function useGuardar() {
  const consultas = useQueryClient();
  const [ocupado, setOcupado] = useState(false);

  const guardar = useCallback(
    async (accion: () => Promise<unknown>, listo?: string): Promise<boolean> => {
      setOcupado(true);
      try {
        await accion();
        await Promise.all(
          [claves.admin, claves.carta, claves.mesas, claves.repartidores, ["sesion"]].map((queryKey) => consultas.invalidateQueries({ queryKey })),
        );
        if (listo) toast.success(listo);
        return true;
      } catch (error) {
        toast.error(mensajeDe(error));
        return false;
      } finally {
        setOcupado(false);
      }
    },
    [consultas],
  );

  return { guardar, ocupado };
}
