import { ArrowsClockwiseIcon, TrashIcon } from "@phosphor-icons/react";
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router";
import { Boton } from "../componentes/Boton";
import { BotonConfirmar } from "../componentes/BotonConfirmar";
import { HojaInferior } from "../componentes/HojaInferior";
import { plural, soles } from "../lib/formato";
import { useUltimo } from "../lib/useUltimo";
import {
  abrir,
  abrirCola,
  cerrar,
  descartarEnvio,
  procesarCola,
  reintentarAhora,
  resolverComoRonda,
  resolverRevisando,
  useMozo,
} from "../mozo/almacen";
import { cantidadTotal, montoTotal } from "../mozo/lineas";
import { useAvisosListo } from "../mozo/useAvisosListo";
import { useSesion } from "../sesion/contexto";
import { useConexion } from "../tiempo-real/contexto";

// Todo /mozo cuelga de aquí: abre los borradores y la cola del usuario,
// reintenta los envíos cuando vuelve la red y avisa de los pedidos listos.
export function ProveedorMozo() {
  const { usuario } = useSesion();
  const usuarioId = usuario!.id;
  const conexion = useConexion();

  useEffect(() => {
    abrir(usuarioId);
    return cerrar;
  }, [usuarioId]);

  // Vuelve el tiempo real, la red o la app al frente: buen momento para reintentar
  useEffect(() => {
    if (conexion === "en-linea") void procesarCola();
  }, [conexion]);

  useEffect(() => {
    const alVolver = () => document.visibilityState === "visible" && void procesarCola();
    const alConectar = () => void procesarCola();
    window.addEventListener("online", alConectar);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.removeEventListener("online", alConectar);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, []);

  useAvisosListo(usuarioId);

  return (
    <>
      <Outlet />
      <HojaCola />
      <HojaMesaOcupada />
    </>
  );
}

// Lista de lo que todavía no llegó a cocina
function HojaCola() {
  const { cola, colaAbierta, enviando } = useMozo();
  const pendientes = cola.filter((e) => e.estado === "pendiente");

  useEffect(() => {
    if (colaAbierta && pendientes.length === 0) abrirCola(false);
  }, [colaAbierta, pendientes.length]);

  return (
    <HojaInferior
      abierta={colaAbierta && pendientes.length > 0}
      alCerrar={() => abrirCola(false)}
      titulo={plural(pendientes.length, "pedido por enviar", "pedidos por enviar")}
      detalle="Están guardados en este celular. Se envían solos cuando vuelva la conexión."
      pie={
        <Boton
          onClick={reintentarAhora}
          ocupado={enviando !== null}
          icono={<ArrowsClockwiseIcon aria-hidden="true" weight="bold" className="size-6" />}
        >
          {enviando ? "Enviando" : "Reintentar ahora"}
        </Boton>
      }
    >
      <ul className="flex flex-col gap-3">
        {pendientes.map((envio) => (
          <li key={envio.id} className="flex items-center gap-3 rounded-control border-2 border-borde-fuerte px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-xl font-bold text-tinta">{envio.destino.nombre}</p>
              <p className="text-lg tabular-nums">
                {envio.pedidoId ? "Ronda · " : ""}
                {plural(cantidadTotal(envio.lineas), "plato", "platos")} · {soles(montoTotal(envio.lineas))}
              </p>
            </div>
            <BotonConfirmar
              texto="Descartar"
              pregunta="Sí, borrar"
              ocupado={enviando === envio.id}
              alConfirmar={() => descartarEnvio(envio.id)}
              icono={<TrashIcon aria-hidden="true" weight="bold" className="size-5" />}
            />
          </li>
        ))}
      </ul>
      <p className="mt-4 text-lg text-pretty text-marino">
        Si descartas uno, revisa la mesa antes de anotarlo otra vez: con la conexión fallando, puede que sí haya llegado a
        cocina.
      </p>
    </HojaInferior>
  );
}

// 409 MESA_OCUPADA: otro mozo abrió la mesa antes. Lo anotado no se pierde:
// se suma como ronda o queda como borrador para revisarlo.
function HojaMesaOcupada() {
  const navegar = useNavigate();
  const { cola } = useMozo();
  const conflicto = cola.find((e) => e.estado === "conflicto");
  const visible = useUltimo(conflicto);

  return (
    <HojaInferior
      abierta={conflicto !== undefined}
      alCerrar={() => conflicto && resolverRevisando(conflicto.id)}
      titulo={`${visible?.destino.nombre ?? "La mesa"} ya tiene un pedido abierto`}
      detalle="Lo que anotaste no se envió todavía."
      pie={
        <div className="flex flex-col gap-3">
          <Boton onClick={() => conflicto && resolverComoRonda(conflicto.id)}>Agregar como ronda</Boton>
          <Boton
            variante="secundario"
            onClick={() => {
              if (!conflicto) return;
              const pedidoId = conflicto.conflictoPedidoId;
              resolverRevisando(conflicto.id);
              void navegar(`/mozo/pedido/${pedidoId}`);
            }}
          >
            Revisar pedido
          </Boton>
        </div>
      }
    >
      {visible && (
        <ul className="flex flex-col gap-1 text-lg">
          {visible.lineas.map((linea) => (
            <li key={linea.id}>
              <span className="font-bold tabular-nums">{linea.cantidad}×</span> {linea.nombre}
            </li>
          ))}
        </ul>
      )}
    </HojaInferior>
  );
}
