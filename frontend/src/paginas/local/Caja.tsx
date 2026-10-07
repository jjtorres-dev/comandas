import { CheckCircleIcon, WifiSlashIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ErrorDeCarga, Esqueleto } from "../../componentes/EstadoDeCarga";
import { PildoraEstado } from "../../componentes/PildoraEstado";
import { consultaCaja, consultaCobrados, consultaPedidosActivos } from "../../lib/consultas";
import { plural } from "../../lib/formato";
import type { CierreDeCaja, Pedido, Turno } from "../../lib/tipos";
import { nombreDeTipo } from "../../local/comandas";
import { centimos, soles } from "../../local/dinero";
import { TIPOS } from "../../local/tiposDePedido";
import { useConexion } from "../../tiempo-real/contexto";
import { CobrarPedido } from "./caja/CobrarPedido";
import { Cobrados } from "./caja/Cobrados";
import { CajaCerrada, CerrarCaja, FranjaDeTurno } from "./caja/Turno";

let ultimoCierre: CierreDeCaja | null = null;

// Caja: la misma persona de la cocina, en el monitor con mouse y teclado,
// entre plato y plato. Cobrar rápido y sin errores de vuelto.
export function Caja() {
  const turno = useQuery(consultaCaja);
  const { data: pedidos } = useQuery(consultaPedidosActivos);
  // El resumen del último cierre se muestra hasta que se abre la caja otra vez,
  // aunque entretanto se pase por la pestaña Cocina
  const [cierre, setCierreLocal] = useState<CierreDeCaja | null>(ultimoCierre);
  const setCierre = (nuevo: CierreDeCaja) => {
    ultimoCierre = nuevo;
    setCierreLocal(nuevo);
  };

  const porCobrar = (pedidos ?? []).filter((p) => !p.pagado);

  if (turno.isPending) return <Esqueleto className="h-96" />;
  if (turno.isError) return <ErrorDeCarga error={turno.error} alReintentar={() => void turno.refetch()} />;
  if (!turno.data) return <CajaCerrada cierre={cierre} porCobrar={porCobrar.length} />;

  return <CajaAbierta turno={turno.data} porCobrar={porCobrar} cargando={pedidos === undefined} alCerrarCaja={setCierre} />;
}

type Vista = "cobrar" | "cobrados";

function CajaAbierta({ turno, porCobrar, cargando, alCerrarCaja }: { turno: Turno; porCobrar: Pedido[]; cargando: boolean; alCerrarCaja: (c: CierreDeCaja) => void }) {
  const enLinea = useConexion() === "en-linea";
  const { data: cobrados } = useQuery(consultaCobrados);
  const [vista, setVista] = useState<Vista>("cobrar");
  // El pedido que se está cobrando. Se guarda entero: al quedar pagado sale de
  // "por cobrar", pero su pantalla de "Cobrado" (vuelto, nota de venta) sigue ahí
  const [elegido, setElegido] = useState<Pedido | null>(null);
  const [cerrando, setCerrando] = useState(false);

  const actual = elegido ? (porCobrar.find((p) => p.id === elegido.id) ?? elegido) : null;
  const siguiente = () => setElegido(porCobrar.find((p) => p.id !== elegido?.id) ?? null);

  // Flechas: recorren la lista de por cobrar
  const estado = useRef({ porCobrar, elegido, vista });
  useEffect(() => {
    estado.current = { porCobrar, elegido, vista };
  });
  useEffect(() => {
    const alPulsar = (evento: KeyboardEvent) => {
      if (evento.key !== "ArrowDown" && evento.key !== "ArrowUp") return;
      const { porCobrar: lista, elegido: marcado, vista: enVista } = estado.current;
      if (enVista !== "cobrar" || lista.length === 0 || document.querySelector("dialog[open]")) return;
      // Mientras se escribe un monto o un texto, las flechas son del campo
      if ((evento.target as HTMLElement).matches("input, textarea, select")) return;
      evento.preventDefault();
      const indice = lista.findIndex((p) => p.id === marcado?.id);
      const paso = evento.key === "ArrowDown" ? 1 : -1;
      setElegido(lista[indice === -1 ? 0 : Math.min(lista.length - 1, Math.max(0, indice + paso))]);
    };
    window.addEventListener("keydown", alPulsar);
    return () => window.removeEventListener("keydown", alPulsar);
  }, []);

  return (
    <div className="flex flex-1 flex-col gap-4 pb-28 lg:pb-20">
      <h1 className="sr-only">Caja</h1>

      {!enLinea && (
        <p role="alert" className="flex items-center gap-3 rounded-control bg-alerta px-4 py-3 text-xl font-bold text-tinta">
          <WifiSlashIcon aria-hidden="true" weight="bold" className="size-8 shrink-0" />
          Sin conexión. No se puede cobrar hasta que vuelva.
        </p>
      )}

      <div role="tablist" aria-label="Caja" className="flex gap-2">
        {(
          [
            ["cobrar", "Por cobrar", porCobrar.length],
            ["cobrados", "Cobrados de este turno", cobrados?.length ?? turno.pedidosCobrados],
          ] as const
        ).map(([id, nombre, cuantos]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={vista === id}
            onClick={() => setVista(id)}
            className={`presionable inline-flex min-h-14 cursor-pointer items-center gap-2.5 rounded-control border-2 px-5 text-xl font-bold ${
              vista === id ? "border-tinta bg-primario text-tinta" : "border-borde-fuerte bg-superficie text-marino hover:bg-primario-suave"
            }`}
          >
            {nombre}
            <span className="tabular-nums">{cuantos}</span>
          </button>
        ))}
      </div>

      {vista === "cobrados" ? (
        <Cobrados />
      ) : (
        <div
          // Tres columnas desde 1280 px; entre 1024 y 1279, lista y cuenta, con el cobro debajo
          className="grid items-start gap-5 lg:grid-cols-[19rem_minmax(0,1fr)] xl:grid-cols-[21rem_minmax(0,1fr)_27rem]"
          // Tras un clic del mouse, el foco pasa al panel de cobro en vez de quedarse en
          // el botón: así el Enter siguiente cobra y no repite ese botón. Con teclado
          // (Tab y Enter) los botones se comportan como siempre.
          onClick={(evento) => {
            const destino = evento.target as HTMLElement;
            const boton = destino.closest("button");
            if (evento.detail === 0 || !boton || destino.closest("dialog") || document.activeElement !== boton) return;
            evento.currentTarget.querySelector<HTMLElement>("[data-cobro]")?.focus({ preventScroll: true });
          }}
        >
          {/* En celular, con un pedido elegido, la lista deja su lugar a la cuenta */}
          <nav aria-label="Por cobrar" className={`lg:row-span-2 xl:row-span-1 ${actual ? "hidden lg:block" : ""}`}>
            {cargando ? (
              <Esqueleto className="h-64" />
            ) : porCobrar.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-panel border-2 border-dashed border-borde-fuerte px-5 py-10 text-center">
                <CheckCircleIcon aria-hidden="true" weight="duotone" className="size-16 text-primario-fuerte" />
                <p className="text-2xl font-bold text-tinta">Todo cobrado</p>
                <p className="text-lg text-marino">Los pedidos aparecen aquí apenas se toman.</p>
              </div>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {porCobrar.map((pedido) => (
                  <li key={pedido.id}>
                    <FilaPorCobrar pedido={pedido} elegido={pedido.id === actual?.id} alElegir={() => setElegido(pedido)} />
                  </li>
                ))}
              </ul>
            )}
          </nav>

          {actual ? (
            <CobrarPedido key={actual.id} pedido={actual} alSalir={() => setElegido(null)} alSiguiente={siguiente} />
          ) : (
            porCobrar.length > 0 && (
              <p className="hidden rounded-panel border-2 border-dashed border-borde-fuerte px-6 py-16 text-center text-2xl text-marino lg:block xl:col-span-2">
                Elige un pedido de la lista para cobrarlo.
                <span className="mt-2 block text-lg text-texto-suave">Con el teclado: flechas para elegir, E, Y, P o T para el método y Enter para cobrar.</span>
              </p>
            )
          )}
        </div>
      )}

      <FranjaDeTurno turno={turno} alCerrar={() => setCerrando(true)} />
      <CerrarCaja
        abierto={cerrando}
        alCancelar={() => setCerrando(false)}
        alCerrarCaja={(cierre) => {
          setCerrando(false);
          alCerrarCaja(cierre);
        }}
        turno={turno}
        sinCobrar={porCobrar.length}
      />
    </div>
  );
}

function FilaPorCobrar({ pedido, elegido, alElegir }: { pedido: Pedido; elegido: boolean; alElegir: () => void }) {
  const tipo = TIPOS[pedido.tipo];
  const parcial = centimos(pedido.totalPagado) > 0;
  const boton = useRef<HTMLButtonElement>(null);

  // Al recorrer con las flechas, la fila elegida queda a la vista
  useEffect(() => {
    if (elegido) boton.current?.scrollIntoView({ block: "nearest" });
  }, [elegido]);

  return (
    <button
      ref={boton}
      type="button"
      aria-current={elegido ? "true" : undefined}
      onClick={alElegir}
      className={`presionable flex w-full cursor-pointer flex-col overflow-hidden rounded-control border-2 bg-superficie text-left ${
        elegido ? "border-tinta outline-3 outline-offset-0 outline-tinta" : "border-borde-fuerte hover:bg-primario-suave"
      }`}
    >
      <span className={`flex items-center gap-2 px-3 py-1.5 text-lg font-bold text-tinta ${tipo.clases}`}>
        <tipo.icono aria-hidden="true" weight="bold" className="size-6 shrink-0" />
        <span className="min-w-0 flex-1 leading-tight wrap-anywhere">{nombreDeTipo(pedido)}</span>
        <span className="tabular-nums">#{pedido.numero}</span>
      </span>
      <span className="flex items-center gap-3 px-3 py-2">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-2xl font-bold text-tinta tabular-nums">{soles(centimos(pedido.saldoPendiente))}</span>
          {parcial && <span className="text-base font-bold text-marino tabular-nums">Falta de {soles(centimos(pedido.total))}</span>}
        </span>
        <PildoraEstado estado={pedido.estado} />
      </span>
      <span className="sr-only">{plural(pedido.items.filter((i) => i.estado !== "CANCELADO").length, "plato", "platos")}</span>
    </button>
  );
}
