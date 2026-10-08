import { CheckCircleIcon, PlusIcon, WifiSlashIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ErrorDeCarga, Esqueleto } from "../../componentes/EstadoDeCarga";
import { consultaCarta, consultaPorTelefono, consultaRepartidores } from "../../lib/consultas";
import { useAhora } from "../../lib/formato";
import type { Pedido } from "../../lib/tipos";
import { porRendir } from "../../local/delivery";
import { centimos, soles } from "../../local/dinero";
import { useSesion } from "../../sesion/contexto";
import { useConexion } from "../../tiempo-real/contexto";
import { Cobrar } from "./delivery/Cobrar";
import { Modificar } from "./delivery/Modificar";
import { NuevoPedido } from "./delivery/NuevoPedido";
import { Rendicion } from "./delivery/Rendicion";
import { Tablero } from "./delivery/Tablero";

// Pedidos por teléfono: la misma persona de la cocina y la caja, en el monitor,
// mientras atiende una llamada. Registrar el pedido tiene que tomar menos de un minuto.
export function Delivery() {
  const { negocio } = useSesion();
  const pedidos = useQuery(consultaPorTelefono);
  const carta = useQuery(consultaCarta);
  const { data: repartidores = [] } = useQuery(consultaRepartidores);
  const enLinea = useConexion() === "en-linea";
  const ahora = useAhora();
  const [anotando, setAnotando] = useState(false);
  // Confirmación del último pedido enviado: el total que se le dijo al cliente
  const [enviado, setEnviado] = useState<Pedido | null>(null);
  const [enviadoDistinto, setEnviadoDistinto] = useState(false);
  // Se guardan los ids: el pedido que se muestra es siempre el del servidor, al día
  const [modificando, setModificando] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState<string | null>(null);

  const lista = pedidos.data ?? [];
  const buscar = (id: string | null) => (id ? (lista.find((p) => p.id === id) ?? null) : null);
  const aModificar = buscar(modificando);
  // Solo se modifica antes de que salga: si entretanto salió o se canceló, el diálogo se cierra
  const modificable = aModificar && (aModificar.estado === "PENDIENTE" || aModificar.estado === "PREPARANDO" || aModificar.estado === "LISTO") ? aModificar : null;
  const aCobrar = buscar(cobrando);

  // N abre un pedido nuevo desde el tablero
  useEffect(() => {
    if (anotando) return;
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key.toLowerCase() !== "n" || evento.ctrlKey || evento.metaKey || evento.altKey) return;
      if (document.querySelector("dialog[open]") || (evento.target as HTMLElement).matches("input, textarea, select")) return;
      evento.preventDefault();
      setAnotando(true);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, [anotando]);

  if (!carta.data || !pedidos.data) {
    const fallo = carta.isError ? carta : pedidos.isError ? pedidos : null;
    return fallo ? <ErrorDeCarga error={fallo.error} alReintentar={() => void fallo.refetch()} /> : <Esqueleto className="h-96" />;
  }

  if (anotando) {
    return (
      <NuevoPedido
        carta={carta.data}
        alTerminar={(pedido, distinto = false) => {
          setEnviado(pedido);
          setEnviadoDistinto(distinto);
          setAnotando(false);
        }}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <h1 className="sr-only">Delivery</h1>

      {!enLinea && (
        <p role="alert" className="flex items-center gap-3 rounded-control bg-alerta px-4 py-3 text-xl font-bold text-tinta">
          <WifiSlashIcon aria-hidden="true" weight="bold" className="size-8 shrink-0" />
          Sin conexión. Lo que ves puede estar desactualizado.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setAnotando(true)}
          aria-keyshortcuts="N"
          className="presionable inline-flex min-h-16 cursor-pointer items-center gap-3 rounded-control bg-primario px-6 text-2xl font-bold text-tinta hover:bg-primario-presionado"
        >
          <PlusIcon aria-hidden="true" weight="bold" className="size-7" />
          Nuevo pedido
          <kbd aria-hidden="true" className="hidden size-9 place-items-center rounded-interior border-2 border-current font-sans text-lg lg:grid">
            N
          </kbd>
        </button>
        {enviado && (
          <p role="status" className={`flex flex-1 items-center gap-2.5 rounded-control px-4 py-3 text-xl font-bold text-tinta ${enviadoDistinto ? "bg-alerta" : "bg-listo-suave"}`}>
            <CheckCircleIcon aria-hidden="true" weight="fill" className={`size-7 shrink-0 ${enviadoDistinto ? "text-tinta" : "text-listo-fuerte"}`} />
            <span className="flex-1 tabular-nums">
              Pedido #{enviado.numero} enviado a cocina · Total {soles(centimos(enviado.total))}
              {/* Un reintento puede devolver el pedido tal como llegó la primera vez */}
              {enviadoDistinto && ". Ese total no coincide con lo último que anotaste: revísalo con Modificar."}
            </span>
            <button type="button" onClick={() => setEnviado(null)} className="min-h-12 cursor-pointer px-2 underline decoration-2 underline-offset-4">
              Cerrar
            </button>
          </p>
        )}
      </div>

      <Rendicion pedidos={porRendir(lista)} />

      {lista.length === 0 ? (
        <div className="flex min-h-64 flex-1 flex-col items-center justify-center gap-3 rounded-panel border-2 border-dashed border-borde-fuerte px-6 py-12 text-center">
          <p className="text-3xl font-bold text-tinta">Todavía no hay pedidos por teléfono</p>
          <p className="max-w-[40ch] text-xl text-pretty text-marino">Cuando llamen o escriban, toca "Nuevo pedido" (o la tecla N) y empieza por el celular del cliente.</p>
        </div>
      ) : (
        <Tablero
          pedidos={lista}
          repartidores={repartidores}
          region={carta.data.reparto.region}
          negocio={negocio?.nombre ?? ""}
          ahora={ahora}
          alModificar={(pedido) => setModificando(pedido.id)}
          alCobrar={(pedido) => setCobrando(pedido.id)}
        />
      )}

      <Modificar pedido={modificable} carta={carta.data} alCerrar={() => setModificando(null)} />
      <Cobrar pedido={aCobrar && !aCobrar.pagado ? aCobrar : null} alCerrar={() => setCobrando(null)} />
    </div>
  );
}
