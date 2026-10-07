import { CheckCircleIcon, LockIcon, LockOpenIcon, ProhibitIcon, WarningIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { Boton } from "../../../componentes/Boton";
import { Campo } from "../../../componentes/Campo";
import { Dialogo } from "../../../componentes/Dialogo";
import { api, mensajeDe } from "../../../lib/api";
import { claves, clienteDeConsultas } from "../../../lib/consultas";
import { horaDe, plural } from "../../../lib/formato";
import type { CierreDeCaja, Turno } from "../../../lib/tipos";
import { centimos, leerMonto, METODOS, paraApi, soles } from "../../../local/dinero";

const refrescarCaja = () => void clienteDeConsultas.invalidateQueries({ queryKey: claves.caja });

// Diferencia entre lo contado y lo esperado, con su palabra: nunca solo un número con signo
function Diferencia({ centavos, grande = false }: { centavos: number; grande?: boolean }) {
  const [clases, Icono, texto] =
    centavos === 0
      ? (["bg-listo text-tinta", CheckCircleIcon, "Cuadra"] as const)
      : centavos < 0
        ? (["bg-peligro text-white", WarningIcon, `Falta ${soles(-centavos)}`] as const)
        : (["bg-alerta text-tinta", WarningIcon, `Sobra ${soles(centavos)}`] as const);
  return (
    <p role="status" className={`flex items-center gap-3 rounded-control px-4 py-3 font-bold tabular-nums ${grande ? "text-4xl" : "text-2xl"} ${clases}`}>
      <Icono aria-hidden="true" weight="fill" className="size-8 shrink-0" />
      {texto}
    </p>
  );
}

// Sin turno abierto no se cobra: la pestaña solo pide el sencillo y abre
export function CajaCerrada({ cierre, porCobrar }: { cierre: CierreDeCaja | null; porCobrar: number }) {
  const [monto, setMonto] = useState("");
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inicial = leerMonto(monto || "0");

  async function abrir() {
    if (abriendo) return;
    if (inicial === null) return setError("Escribe un monto, por ejemplo 100 o 50.50");
    setAbriendo(true);
    setError(null);
    try {
      await api("/caja/abrir", { metodo: "POST", cuerpo: { montoInicial: paraApi(inicial) } });
      refrescarCaja();
    } catch (causa) {
      setError(mensajeDe(causa));
      setAbriendo(false);
    }
  }

  return (
    <div className="m-auto flex w-full max-w-xl flex-col gap-6 py-6">
      {cierre && <ResumenDeCierre cierre={cierre} />}
      <form
        className="flex flex-col gap-5 rounded-panel border-2 border-borde-fuerte bg-superficie p-6"
        onSubmit={(e) => {
          e.preventDefault();
          void abrir();
        }}
      >
        <h1 className="flex items-center gap-3 text-3xl font-bold text-tinta">
          <LockIcon aria-hidden="true" weight="bold" className="size-9 shrink-0" />
          La caja está cerrada
        </h1>
        <Campo
          etiqueta="¿Con cuánto sencillo abres? (S/)"
          ayuda="El efectivo que hay en el cajón antes de cobrar. Si no hay, déjalo en 0."
          name="montoInicial"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          placeholder="0"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          error={error}
        />
        <Boton type="submit" ocupado={abriendo} className="min-h-18 text-2xl" icono={<LockOpenIcon aria-hidden="true" weight="bold" className="size-7" />}>
          Abrir caja
        </Boton>
        {porCobrar > 0 && (
          <p className="text-center text-lg text-marino">
            {plural(porCobrar, "pedido espera", "pedidos esperan")} cobro: sin caja abierta no se puede cobrar.
          </p>
        )}
      </form>
    </div>
  );
}

function ResumenDeCierre({ cierre }: { cierre: CierreDeCaja }) {
  const { turno } = cierre;
  return (
    <section aria-label="Resumen del cierre" className="flex flex-col gap-3 rounded-panel border-2 border-borde bg-fondo p-5">
      <h2 className="text-2xl font-bold text-tinta">Caja cerrada a las {turno.cerradoEn ? horaDe(turno.cerradoEn) : ""}</h2>
      <dl className="flex flex-col gap-1 text-xl tabular-nums">
        {METODOS.map((m) => (
          <div key={m.id} className="flex justify-between gap-3">
            <dt>{m.nombre}</dt>
            <dd>{soles(centimos(turno.totalesPorMetodo[m.id]))}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t-2 border-borde pt-1 font-bold text-tinta">
          <dt>Total cobrado</dt>
          <dd>{soles(centimos(turno.totalCobrado))}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Efectivo esperado</dt>
          <dd>{soles(centimos(turno.efectivoEsperado))}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Efectivo contado</dt>
          <dd>{soles(centimos(turno.efectivoContado ?? "0"))}</dd>
        </div>
      </dl>
      <Diferencia centavos={centimos(turno.diferencia ?? "0")} />
      {turno.pagosAnulados > 0 && <p className="text-lg font-bold text-marino">{plural(turno.pagosAnulados, "pago anulado", "pagos anulados")} en el turno.</p>}
      {cierre.aviso && <p className="text-lg font-bold text-alerta-fuerte">{cierre.aviso}</p>}
    </section>
  );
}

// Resumen del turno, siempre a la vista, y la puerta al cierre
export function FranjaDeTurno({ turno, alCerrar }: { turno: Turno; alCerrar: () => void }) {
  return (
    <aside
      aria-label="Caja de este turno"
      className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-borde bg-superficie px-4 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.625rem)] shadow-barra lg:px-8"
    >
      <div className="flex items-center gap-x-6 gap-y-2">
        <dl className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-1 text-lg tabular-nums lg:text-xl">
          {METODOS.map((m) => (
            // En celular la franja muestra solo lo esencial: el efectivo esperado y cerrar
            <div key={m.id} className="hidden gap-2 sm:flex">
              <dt>{m.nombre}</dt>
              <dd className="font-bold text-tinta">{soles(centimos(turno.totalesPorMetodo[m.id]))}</dd>
            </div>
          ))}
          <div className="hidden gap-2 lg:flex">
            <dt>Total cobrado</dt>
            <dd className="font-bold text-tinta">{soles(centimos(turno.totalCobrado))}</dd>
          </div>
          {/* Lo que tiene que haber en el cajón: el dato que más se consulta */}
          <div className="flex flex-wrap items-baseline gap-x-2 rounded-control bg-primario-suave px-3 py-1 text-tinta">
            <dt className="text-base font-bold sm:text-lg lg:text-xl">Efectivo esperado</dt>
            <dd className="text-2xl font-bold lg:text-3xl">{soles(centimos(turno.efectivoEsperado))}</dd>
          </div>
          {turno.pagosAnulados > 0 && (
            <div className="flex items-center gap-1.5 font-bold text-peligro">
              <ProhibitIcon aria-hidden="true" weight="bold" className="size-5 shrink-0" />
              {plural(turno.pagosAnulados, "pago anulado", "pagos anulados")}
            </div>
          )}
        </dl>
        <button
          type="button"
          onClick={alCerrar}
          className="presionable inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-2 rounded-control border-2 border-marino bg-superficie px-4 text-xl font-bold whitespace-nowrap text-marino hover:bg-primario-suave"
        >
          <LockIcon aria-hidden="true" weight="bold" className="size-6" />
          Cerrar caja
        </button>
      </div>
    </aside>
  );
}

type PropsCierre = {
  abierto: boolean;
  alCancelar: () => void;
  alCerrarCaja: (cierre: CierreDeCaja) => void;
  turno: Turno;
  // Pedidos que quedan sin cobrar (del todo o en parte): se avisa, no se impide
  sinCobrar: number;
};

export function CerrarCaja({ abierto, alCancelar, alCerrarCaja, turno, sinCobrar }: PropsCierre) {
  const [contado, setContado] = useState("");
  const [observacion, setObservacion] = useState("");
  const [cerrando, setCerrando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [previo, setPrevio] = useState(abierto);
  if (abierto !== previo) {
    setPrevio(abierto);
    if (abierto) {
      setContado("");
      setObservacion("");
      setError(null);
    }
  }

  const cContado = contado.trim() ? leerMonto(contado) : null;
  const esperado = centimos(turno.efectivoEsperado);
  const diferencia = cContado === null ? null : cContado - esperado;
  // Cerrar no tiene vuelta atrás. Si la caja no cuadra (o fue un dedazo: 15 por
  // 150), no se cierra con un Enter: hay que confirmar la diferencia con el botón, dos veces.
  const [confirmando, setConfirmando] = useState(false);
  const [contadoVisto, setContadoVisto] = useState(contado);
  if (contado !== contadoVisto) {
    setContadoVisto(contado);
    setConfirmando(false);
  }

  async function cerrar() {
    if (cContado === null || cerrando) return;
    setCerrando(true);
    setError(null);
    try {
      const cierre = await api<CierreDeCaja>("/caja/cerrar", {
        metodo: "POST",
        cuerpo: { efectivoContado: paraApi(cContado), ...(observacion.trim() ? { observacion: observacion.trim() } : {}) },
      });
      alCerrarCaja(cierre);
      refrescarCaja();
    } catch (causa) {
      setError(mensajeDe(causa));
    } finally {
      setCerrando(false);
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCancelar}
      titulo="Cerrar caja"
      pie={
        diferencia === null || diferencia === 0 ? (
          <Boton ocupado={cerrando} disabled={diferencia === null} onClick={() => void cerrar()} icono={<LockIcon aria-hidden="true" weight="bold" className="size-6" />}>
            Confirmar cierre
          </Boton>
        ) : (
          <button
            type="button"
            disabled={cerrando}
            onClick={() => (confirmando ? void cerrar() : setConfirmando(true))}
            className={`presionable inline-flex min-h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-control border-2 border-peligro px-5 text-xl font-bold disabled:opacity-60 ${
              confirmando ? "bg-peligro text-white" : "bg-superficie text-peligro hover:bg-peligro-suave"
            }`}
          >
            <LockIcon aria-hidden="true" weight="bold" className="size-6 shrink-0" />
            <span aria-live="polite">
              {confirmando ? "Sí, cerrar así" : `Cerrar con ${soles(Math.abs(diferencia))} de ${diferencia < 0 ? "falta" : "sobra"}`}
            </span>
          </button>
        )
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          // Enter solo cierra cuando cuadra
          if (diferencia === 0) void cerrar();
        }}
      >
        <p className="flex items-baseline justify-between gap-3 text-xl text-marino tabular-nums">
          <span>Efectivo esperado</span>
          <strong className="text-2xl text-tinta">{soles(esperado)}</strong>
        </p>
        <Campo
          etiqueta="¿Cuánto efectivo hay en el cajón? (S/)"
          name="efectivoContado"
          inputMode="decimal"
          autoComplete="off"
          autoFocus
          value={contado}
          onChange={(e) => setContado(e.target.value)}
          error={contado.trim() && cContado === null ? "Escribe un monto, por ejemplo 246 o 246.50" : null}
        />
        {diferencia !== null && <Diferencia centavos={diferencia} grande />}
        {diferencia !== null && diferencia !== 0 && (
          <p className="text-lg font-bold text-marino">Revisa lo contado. Si de verdad hay diferencia, confírmala con el botón de abajo.</p>
        )}
        <div className="flex flex-col gap-2">
          <label htmlFor="observacion-cierre" className="text-lg font-bold text-marino">
            Observación (opcional)
          </label>
          <textarea
            id="observacion-cierre"
            rows={2}
            maxLength={500}
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            className="w-full rounded-control border-2 border-borde-fuerte bg-superficie px-4 py-3 text-xl text-tinta focus:border-marino"
          />
        </div>
        {sinCobrar > 0 && (
          <p className="flex items-start gap-2.5 rounded-control bg-alerta-suave px-4 py-3 text-lg font-bold text-alerta-fuerte">
            <WarningIcon aria-hidden="true" weight="fill" className="mt-0.5 size-6 shrink-0" />
            {plural(sinCobrar, "pedido queda", "pedidos quedan")} sin cobrar. Se puede cerrar igual; seguirán en "Por cobrar" cuando abras otra vez.
          </p>
        )}
        <p className="text-lg text-marino">Después de cerrar no se puede corregir ningún pago de este turno.</p>
        {error && (
          <p role="alert" className="text-lg font-bold text-peligro">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Dialogo>
  );
}
