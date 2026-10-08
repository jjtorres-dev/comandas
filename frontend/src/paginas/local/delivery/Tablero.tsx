import {
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  HourglassMediumIcon,
  MapPinIcon,
  MopedIcon,
  PencilSimpleIcon,
  PhoneIcon,
  WarningIcon,
  WhatsappLogoIcon,
} from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Dialogo } from "../../../componentes/Dialogo";
import { api, mensajeDe } from "../../../lib/api";
import { claves } from "../../../lib/consultas";
import { haceCuanto, plural } from "../../../lib/formato";
import type { Pedido, Repartidor } from "../../../lib/tipos";
import { type Columna, COLUMNAS, columnaDe, enlaceWhatsapp, mensajeParaCliente, mensajeParaMotorizado, pagoEnPalabras } from "../../../local/delivery";
import { centimos, soles } from "../../../local/dinero";
import { TIPOS } from "../../../local/tiposDePedido";

type Props = {
  pedidos: Pedido[];
  repartidores: Repartidor[];
  region: string | null;
  negocio: string;
  ahora: number;
  alModificar: (pedido: Pedido) => void;
  alCobrar: (pedido: Pedido) => void;
  // Tras "Salió" o "Entregado": qué se hizo y cómo deshacerlo (barra de 8 segundos)
  alDespachar: (texto: string, deshacer: () => Promise<unknown>) => void;
};

const ACCION = "presionable inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-control px-3 text-lg font-bold whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-60";
const PRINCIPAL = `${ACCION} bg-primario text-tinta hover:bg-primario-presionado`;
const CONTORNO = `${ACCION} border-2 border-marino bg-superficie text-marino hover:bg-primario-suave`;

// Los pedidos por teléfono del día, por estado. Las tarjetas cambian de
// columna solas cuando cocina marca listo o el pedido sale.
export function Tablero({ pedidos, repartidores, region, negocio, ahora, alModificar, alCobrar, alDespachar }: Props) {
  const consultas = useQueryClient();
  // En celular se ve una columna a la vez
  const [visible, setVisible] = useState<Columna>("cocina");
  const [ocupado, setOcupado] = useState<string | null>(null);
  // Con varios motorizados, "Salió" pregunta cuál
  const [eligiendo, setEligiendo] = useState<Pedido | null>(null);

  const porColumna = (columna: Columna) => pedidos.filter((p) => columnaDe(p) === columna);

  const cambiarEstado = (pedido: Pedido, estado: string) => api(`/pedidos/${pedido.id}/estado`, { metodo: "PATCH", cuerpo: { estado } });
  const asignar = (pedido: Pedido, repartidorId: string | null) => api(`/pedidos/${pedido.id}/repartidor`, { metodo: "PATCH", cuerpo: { repartidorId } });

  // Cada despacho deja a mano cómo deshacerlo
  async function hacer(pedido: Pedido, texto: string, accion: () => Promise<unknown>, deshacer: () => Promise<unknown>) {
    setOcupado(pedido.id);
    try {
      await accion();
      void consultas.invalidateQueries({ queryKey: claves.pedidos });
      alDespachar(`Pedido #${pedido.numero}: ${texto}`, deshacer);
    } catch (causa) {
      toast.error(`Pedido #${pedido.numero}: ${mensajeDe(causa)}`);
    } finally {
      setOcupado(null);
    }
  }

  const salio = (pedido: Pedido, repartidor: Repartidor | null) =>
    hacer(
      pedido,
      "salió",
      async () => {
        if (repartidor) await asignar(pedido, repartidor.id);
        await cambiarEstado(pedido, "EN_CAMINO");
      },
      // Vuelve a esperar en el local; si el motorizado se asignó al salir, se le quita
      async () => {
        await cambiarEstado(pedido, "LISTO");
        if (repartidor) await asignar(pedido, null);
      },
    );

  const entregado = (pedido: Pedido) =>
    hacer(
      pedido,
      "entregado",
      () => cambiarEstado(pedido, "ENTREGADO"),
      // Un delivery vuelve a "en camino"; un para llevar, a "listo para recoger"
      () => cambiarEstado(pedido, pedido.tipo === "DELIVERY" ? "EN_CAMINO" : "LISTO"),
    );

  function alSalir(pedido: Pedido) {
    if (repartidores.length > 1 && !pedido.repartidor) return setEligiendo(pedido);
    void salio(pedido, pedido.repartidor ? null : (repartidores[0] ?? null));
  }

  const abrir = (url: string) => window.open(url, "_blank", "noopener");

  return (
    <>
      <div role="group" aria-label="Estado" className="flex gap-2 overflow-x-auto xl:hidden">
        {COLUMNAS.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={visible === c.id}
            onClick={() => setVisible(c.id)}
            className={`presionable inline-flex min-h-12 shrink-0 cursor-pointer items-center gap-2 rounded-control border-2 px-3 text-lg font-bold ${
              visible === c.id ? "border-tinta bg-primario text-tinta" : "border-borde-fuerte bg-superficie text-marino"
            }`}
          >
            {c.nombre}
            <span className="tabular-nums">{porColumna(c.id).length}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-4">
        {COLUMNAS.map((columna) => {
          const lista = porColumna(columna.id);
          return (
            <section key={columna.id} aria-label={columna.nombre} className={`min-w-0 flex-col gap-3 xl:flex ${visible === columna.id ? "flex" : "hidden"}`}>
              <h2 className="flex items-baseline justify-between gap-2 border-b-[3px] border-tinta pb-1.5 text-2xl font-bold text-tinta">
                {columna.nombre}
                <span className="text-xl tabular-nums">{lista.length}</span>
              </h2>
              {lista.length === 0 ? (
                <p className="rounded-control border-2 border-dashed border-borde px-3 py-6 text-center text-lg text-texto-suave">Nada aquí</p>
              ) : (
                <ul className="flex min-w-0 flex-col gap-3">
                  {lista.map((pedido) => {
                    const tipo = TIPOS[pedido.tipo];
                    const esDelivery = pedido.tipo === "DELIVERY";
                    const pago = pagoEnPalabras(pedido);
                    const telefono = pedido.cliente?.telefono ?? null;
                    const motorizado = pedido.repartidor ?? (repartidores.length === 1 ? repartidores[0] : null);
                    const enEspera = ocupado === pedido.id;
                    // Entregado y pagado: ya no hay nada que hacer con él
                    const cerrado = columna.id === "entregado" && pedido.pagado;
                    return (
                      <li key={pedido.id}>
                        <article
                          aria-label={`Pedido ${pedido.numero}, ${pedido.cliente?.nombre ?? "cliente"}`}
                          className={`flex flex-col overflow-hidden rounded-panel border-2 border-borde-fuerte bg-superficie ${cerrado ? "opacity-70" : ""}`}
                        >
                          <header className={`flex items-center gap-2 px-3 py-2 text-tinta ${tipo.clases}`}>
                            <tipo.icono aria-hidden="true" weight="bold" className="size-7 shrink-0" />
                            <p className="flex-1 text-2xl leading-none font-bold tabular-nums">#{pedido.numero}</p>
                            <p className="flex items-center gap-1.5 text-lg font-bold tabular-nums">
                              <ClockIcon aria-hidden="true" weight="bold" className="size-5" />
                              {haceCuanto(pedido.creadoEn, ahora)}
                            </p>
                          </header>

                          <div className="flex flex-col gap-2.5 p-3">
                            <div>
                              <p className="text-xl leading-tight font-bold text-tinta wrap-anywhere">{pedido.cliente?.nombre ?? "Sin nombre"}</p>
                              {esDelivery ? (
                                <p className="flex items-start gap-1.5 text-lg leading-snug text-marino wrap-anywhere">
                                  <MapPinIcon aria-hidden="true" weight="bold" className="mt-1 size-5 shrink-0" />
                                  <span>
                                    {[pedido.direccionEntrega, pedido.distritoEntrega].filter(Boolean).join(", ")}
                                    {pedido.referenciaEntrega ? ` · ${pedido.referenciaEntrega}` : ""}
                                  </span>
                                </p>
                              ) : (
                                <p className="text-lg text-marino">Lo recoge en el local</p>
                              )}
                              <p className="text-lg text-marino">{plural(pedido.items.filter((i) => i.estado !== "CANCELADO").reduce((s, i) => s + i.cantidad, 0), "plato", "platos")}</p>
                            </div>

                            {telefono && (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="min-w-24 flex-1 text-lg font-bold text-tinta tabular-nums">{telefono}</span>
                                <a href={`tel:${telefono}`} aria-label={`Llamar a ${pedido.cliente?.nombre ?? telefono}`} className={`${CONTORNO} px-3`}>
                                  <PhoneIcon aria-hidden="true" weight="bold" className="size-5" />
                                  Llamar
                                </a>
                                <a
                                  href={enlaceWhatsapp(telefono, "")}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  aria-label={`WhatsApp a ${pedido.cliente?.nombre ?? telefono}`}
                                  className={`${CONTORNO} px-3`}
                                >
                                  <WhatsappLogoIcon aria-hidden="true" weight="bold" className="size-5" />
                                  WhatsApp
                                </a>
                              </div>
                            )}

                            {/* El pago previsto, con ícono y palabras: es lo que lee quien despacha */}
                            <p
                              className={`flex items-start gap-2 rounded-control px-3 py-2 text-lg leading-snug font-bold ${
                                pago.tono === "pagado" ? "bg-listo-suave text-tinta" : pago.tono === "por-confirmar" ? "bg-alerta-suave text-alerta-fuerte" : "bg-fondo text-tinta"
                              }`}
                            >
                              {pago.tono === "pagado" ? (
                                <CheckCircleIcon aria-hidden="true" weight="fill" className="mt-0.5 size-6 shrink-0 text-listo-fuerte" />
                              ) : pago.tono === "por-confirmar" ? (
                                <HourglassMediumIcon aria-hidden="true" weight="bold" className="mt-0.5 size-6 shrink-0" />
                              ) : (
                                <WarningIcon aria-hidden="true" weight="bold" className="mt-0.5 size-6 shrink-0" />
                              )}
                              <span className="tabular-nums">
                                {pago.texto}
                                {pago.tono === "pagado" && ` · ${soles(centimos(pedido.total))}`}
                              </span>
                            </p>

                            {esDelivery && (columna.id === "camino" || columna.id === "entregado") && (
                              <p className="flex items-center gap-1.5 text-lg text-marino">
                                <MopedIcon aria-hidden="true" weight="bold" className="size-5 shrink-0" />
                                {pedido.repartidor?.nombre ?? "Sin motorizado"}
                              </p>
                            )}

                            {!cerrado && (
                              <div className="flex flex-wrap gap-2">
                                {columna.id === "listo" && esDelivery && (
                                  <button type="button" disabled={enEspera} onClick={() => alSalir(pedido)} className={`${PRINCIPAL} flex-1`}>
                                    <MopedIcon aria-hidden="true" weight="fill" className="size-6" />
                                    Salió
                                  </button>
                                )}
                                {(columna.id === "camino" || (columna.id === "listo" && !esDelivery)) && (
                                  <button type="button" disabled={enEspera} onClick={() => void entregado(pedido)} className={`${PRINCIPAL} flex-1`}>
                                    <CheckIcon aria-hidden="true" weight="bold" className="size-6" />
                                    Entregado
                                  </button>
                                )}
                                {!pedido.pagado && pedido.pagoPrevisto?.momento === "ANTICIPADO" && (
                                  <button type="button" onClick={() => alCobrar(pedido)} className={`${columna.id === "entregado" ? PRINCIPAL : CONTORNO} flex-1`}>
                                    Confirmar pago
                                  </button>
                                )}
                                {!pedido.pagado && pedido.pagoPrevisto?.momento !== "ANTICIPADO" && columna.id === "entregado" && (
                                  <button type="button" onClick={() => alCobrar(pedido)} className={`${PRINCIPAL} flex-1`}>
                                    Cobrar {soles(centimos(pedido.saldoPendiente))}
                                  </button>
                                )}
                                {esDelivery && (columna.id === "listo" || columna.id === "camino") && (
                                  <button type="button" onClick={() => abrir(enlaceWhatsapp(motorizado?.telefono, mensajeParaMotorizado(pedido, region)))} className={`${CONTORNO} flex-1`}>
                                    <WhatsappLogoIcon aria-hidden="true" weight="bold" className="size-5" />
                                    Enviar al motorizado
                                  </button>
                                )}
                                {telefono && (columna.id === "camino" || (columna.id === "listo" && !esDelivery)) && (
                                  <button type="button" onClick={() => abrir(enlaceWhatsapp(telefono, mensajeParaCliente(pedido, negocio)))} className={`${CONTORNO} flex-1`}>
                                    Avisar al cliente
                                  </button>
                                )}
                                {(columna.id === "cocina" || columna.id === "listo") && (
                                  <button type="button" onClick={() => alModificar(pedido)} className={`${CONTORNO} flex-1`}>
                                    <PencilSimpleIcon aria-hidden="true" weight="bold" className="size-5" />
                                    Modificar
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </article>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <Dialogo abierto={eligiendo !== null} alCerrar={() => setEligiendo(null)} titulo="¿Con qué motorizado sale?">
        <ul className="flex flex-col gap-3">
          {repartidores.map((repartidor) => (
            <li key={repartidor.id}>
              <button
                type="button"
                onClick={() => {
                  if (eligiendo) void salio(eligiendo, repartidor);
                  setEligiendo(null);
                }}
                className={`${CONTORNO} min-h-14 w-full justify-start text-xl`}
              >
                <MopedIcon aria-hidden="true" weight="bold" className="size-6" />
                {repartidor.nombre}
              </button>
            </li>
          ))}
        </ul>
      </Dialogo>
    </>
  );
}
