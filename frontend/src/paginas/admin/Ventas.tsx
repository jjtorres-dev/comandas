import { CheckCircleIcon, HourglassMediumIcon, WarningIcon } from "@phosphor-icons/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { fechaConMes, hoyEnLima, type Periodo, PERIODOS, periodoEnPalabras, rangoDe, sumarDias } from "../../admin/periodos";
import { cierreDe, correccionEnPalabras, minutosEnPalabras, pedidosPorHora, platosMasPedidos, porMetodo, porTipo, ventasPorDia } from "../../admin/ventas";
import { ErrorDeCarga, Esqueleto } from "../../componentes/EstadoDeCarga";
import { consultaReporte } from "../../lib/consultas";
import { horaDe, plural, soles, useAhora } from "../../lib/formato";
import type { Reporte, Turno } from "../../lib/tipos";
import { Barras, Cifra, Columnas } from "./graficos";
import { Tarjeta } from "./piezas";

const campoFecha = "h-12 rounded-control border-2 border-borde-fuerte bg-superficie px-3 text-lg text-tinta focus:border-marino";

export function Ventas() {
  const hoy = hoyEnLima(useAhora(60_000));
  const [periodo, setPeriodo] = useState<Periodo>("hoy");
  const [propio, setPropio] = useState<{ desde: string; hasta: string } | null>(null);
  const elegido = propio ?? { desde: sumarDias(hoy, -6), hasta: hoy };
  // Un rango al revés o de más de un año no se pide: se avisa
  const rangoValido = elegido.desde <= elegido.hasta && Date.parse(elegido.hasta) - Date.parse(elegido.desde) <= 366 * 86_400_000;
  const rango = periodo === "rango" ? elegido : rangoDe(periodo, hoy);

  const reporte = useQuery({
    ...consultaReporte(rango.desde, rango.hasta),
    enabled: periodo !== "rango" || rangoValido,
    // Al cambiar de periodo se queda lo anterior, atenuado, hasta que llega lo nuevo
    placeholderData: keepPreviousData,
  });

  return (
    <div className="flex flex-col gap-5">
      <h1 className="sr-only">Ventas</h1>

      {/* Un solo filtro, arriba de todo lo que cambia con él */}
      <div className="flex flex-col gap-3">
        <div role="group" aria-label="Periodo" className="grid grid-cols-2 gap-1 rounded-control bg-superficie p-1 sm:inline-grid sm:grid-cols-4 sm:self-start">
          {PERIODOS.map(({ id, nombre }) => (
            <button
              key={id}
              type="button"
              aria-pressed={periodo === id}
              onClick={() => setPeriodo(id)}
              className={`presionable min-h-12 cursor-pointer rounded-interior px-4 text-lg font-bold whitespace-nowrap ${periodo === id ? "bg-marino text-white" : "text-marino hover:bg-primario-suave"}`}
            >
              {nombre}
            </button>
          ))}
        </div>
        {periodo === "rango" && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-lg font-bold text-marino">
              Desde
              <input type="date" value={elegido.desde} max={hoy} onChange={(evento) => evento.target.value && setPropio({ ...elegido, desde: evento.target.value })} className={campoFecha} />
            </label>
            <label className="flex flex-col gap-1 text-lg font-bold text-marino">
              Hasta
              <input type="date" value={elegido.hasta} max={hoy} onChange={(evento) => evento.target.value && setPropio({ ...elegido, hasta: evento.target.value })} className={campoFecha} />
            </label>
            {!rangoValido && (
              <p role="alert" className="flex min-h-12 items-center gap-2 text-lg font-bold text-peligro">
                <WarningIcon aria-hidden="true" weight="fill" className="size-6 shrink-0" />
                {elegido.desde > elegido.hasta ? "La primera fecha tiene que ser anterior a la segunda" : "Elige un año como máximo"}
              </p>
            )}
          </div>
        )}
      </div>

      {reporte.isError && !reporte.data ? (
        <ErrorDeCarga error={reporte.error} alReintentar={() => void reporte.refetch()} />
      ) : !reporte.data ? (
        <div className="flex flex-col gap-4">
          <Esqueleto className="h-40" />
          <Esqueleto className="h-64" />
        </div>
      ) : (
        <div className={`flex flex-col gap-5 transition-opacity duration-150 ${reporte.isPlaceholderData ? "opacity-50" : ""}`} aria-busy={reporte.isPlaceholderData}>
          <Contenido reporte={reporte.data} hoy={hoy} />
        </div>
      )}
    </div>
  );
}

function Contenido({ reporte, hoy }: { reporte: Reporte; hoy: string }) {
  const { ventas, porCobrar, cocina } = reporte;
  const cuando = periodoEnPalabras(reporte.desde, reporte.hasta, hoy);
  const variosDias = reporte.desde !== reporte.hasta;
  const porDia = ventasPorDia(ventas.porDia);
  const horas = pedidosPorHora(reporte.porHora);
  const hayVentas = ventas.pedidos > 0;

  return (
    <>
      <section aria-label="Resumen" className="flex flex-col gap-4">
        <div className="rounded-panel border-2 border-borde bg-superficie px-5 py-5 lg:px-8 lg:py-6">
          <p className="text-xl text-marino">Cobrado {cuando}</p>
          <p className="mt-1 text-6xl leading-none font-bold text-tinta lg:text-7xl">{soles(ventas.total)}</p>
          <p className="mt-3 text-lg text-pretty text-marino">
            {hayVentas
              ? `${plural(ventas.pedidos, "pedido cobrado", "pedidos cobrados")}. Cuenta lo que ya entró a la caja ${variosDias ? "esos días" : "ese día"}; los pagos anulados no suman.`
              : "Todavía no se cobró nada en estas fechas."}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Cifra nombre="Pedidos cobrados" valor={ventas.pedidos} detalle={`de ${reporte.pedidosTomados} tomados`} />
          <Cifra nombre="Cuenta promedio" valor={soles(ventas.ticketPromedio)} detalle="por pedido cobrado" />
          <Cifra
            nombre="Por cobrar"
            valor={soles(porCobrar.total)}
            detalle={porCobrar.pedidos > 0 ? `${plural(porCobrar.pedidos, "pedido", "pedidos")} sin terminar de pagar` : "Nada pendiente"}
          />
          <Cifra nombre="Tiempo de cocina" valor={minutosEnPalabras(cocina.promedioMin)} detalle={cocina.platos > 0 ? "de que se pide un plato a que está listo" : "Aún no hay platos listos"} />
        </dl>
      </section>

      {variosDias && hayVentas && (
        <Tarjeta>
          <h2 className="mb-4 text-2xl font-bold text-tinta">{porDia.categoria === "Mes" ? "Cobrado por mes" : "Cobrado por día"}</h2>
          <Columnas datos={porDia.datos} medida="Cobrado" categoria={porDia.categoria} />
        </Tarjeta>
      )}

      {hayVentas && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Tarjeta>
            <h2 className="mb-4 text-2xl font-bold text-tinta">Cómo pagaron</h2>
            <Barras titulo="Cobrado por forma de pago" filas={porMetodo(reporte)} />
          </Tarjeta>
          <Tarjeta>
            <h2 className="mb-4 text-2xl font-bold text-tinta">Dónde se vendió</h2>
            <Barras titulo="Cobrado por tipo de pedido" filas={porTipo(reporte)} />
          </Tarjeta>
        </div>
      )}

      {reporte.pedidosTomados > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Tarjeta>
            <h2 className="text-2xl font-bold text-tinta">Lo que más se pidió</h2>
            <p className="mb-4 text-base text-marino">Unidades pedidas y lo que suman, sin lo cancelado</p>
            <Barras titulo="Platos más pedidos" filas={platosMasPedidos(reporte)} />
          </Tarjeta>
          <div className="flex flex-col gap-5">
            <Tarjeta>
              <h2 className="text-2xl font-bold text-tinta">A qué hora entran los pedidos</h2>
              <p className="mb-2 text-base text-marino">Pedidos tomados en cada hora</p>
              <Columnas datos={horas} medida="Pedidos" categoria="Hora" />
            </Tarjeta>
            {cocina.porArea.length > 1 && (
              <Tarjeta>
                <h2 className="text-2xl font-bold text-tinta">Cuánto tarda cada área</h2>
                <p className="mb-4 text-base text-marino">Minutos de que se pide a que está listo</p>
                <Barras
                  titulo="Minutos por área"
                  filas={cocina.porArea.map((a) => ({ clave: a.area, nombre: a.area, valor: a.promedioMin ?? 0, texto: minutosEnPalabras(a.promedioMin), detalle: plural(a.platos, "plato", "platos") }))}
                />
              </Tarjeta>
            )}
          </div>
        </div>
      )}

      <Tarjeta>
        <h2 className="mb-3 text-2xl font-bold text-tinta">Turnos de caja</h2>
        {reporte.turnos.length === 0 ? (
          <p className="text-lg text-marino">No se abrió la caja en estas fechas.</p>
        ) : (
          <ul className="divide-y-2 divide-borde">
            {reporte.turnos.map((turno) => (
              <FilaTurno key={turno.id} turno={turno} />
            ))}
          </ul>
        )}
      </Tarjeta>

      {reporte.correcciones.length > 0 && (
        <Tarjeta>
          <h2 className="text-2xl font-bold text-tinta">Pagos corregidos</h2>
          <p className="mb-3 text-base text-marino">Cada cambio de forma de pago y cada pago anulado, con quién lo hizo</p>
          <ul className="divide-y-2 divide-borde">
            {reporte.correcciones.map((c) => (
              <li key={c.id} className="py-3">
                <p className="text-lg font-bold text-pretty text-tinta">{correccionEnPalabras(c)}</p>
                {c.detalle.motivo && <p className="text-lg text-pretty text-marino">Motivo: {c.detalle.motivo}</p>}
                <p className="text-base text-marino">
                  {c.usuario} · {fechaConMes(hoyEnLima(Date.parse(c.creadoEn)))}, {horaDe(c.creadoEn)}
                </p>
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
    </>
  );
}

const CIERRES = {
  abierto: { icono: HourglassMediumIcon, clases: "bg-fondo text-marino" },
  cuadro: { icono: CheckCircleIcon, clases: "bg-listo-suave text-listo-fuerte" },
  falto: { icono: WarningIcon, clases: "bg-peligro-suave text-peligro" },
  sobro: { icono: WarningIcon, clases: "bg-alerta-suave text-alerta-fuerte" },
};

function FilaTurno({ turno }: { turno: Turno }) {
  const cierre = cierreDe(turno);
  const { icono: Icono, clases } = CIERRES[cierre.estado];

  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
      <div className="min-w-0 flex-1 basis-64">
        <p className="text-lg font-bold text-tinta">
          {fechaConMes(hoyEnLima(Date.parse(turno.abiertoEn)))}, de {horaDe(turno.abiertoEn)} a {turno.cerradoEn ? horaDe(turno.cerradoEn) : "ahora"}
        </p>
        <p className="text-base text-pretty text-marino">
          Abrió {turno.abiertoPor.nombre} con {soles(turno.montoInicial)} · {plural(turno.pedidosCobrados, "pedido cobrado", "pedidos cobrados")}
          {turno.pagosAnulados > 0 && ` · ${plural(turno.pagosAnulados, "pago anulado", "pagos anulados")}`}
        </p>
        {turno.observacion && <p className="text-base text-pretty text-marino">Nota del cierre: {turno.observacion}</p>}
      </div>
      <p className="text-xl font-bold text-tinta tabular-nums">{soles(turno.totalCobrado)}</p>
      <p className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-base font-bold ${clases}`}>
        <Icono aria-hidden="true" weight="fill" className="size-5" />
        {cierre.texto}
      </p>
    </li>
  );
}
