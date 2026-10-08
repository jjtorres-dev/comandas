// Pedidos por teléfono: en qué columna del tablero va cada uno, cómo se dice
// su pago previsto y los mensajes de WhatsApp para el motorizado y el cliente.
import type { MetodoPago, Pedido } from "../lib/tipos";
import { centimos, nombreDeMetodo, soles } from "./dinero";

export type Columna = "cocina" | "listo" | "camino" | "entregado";

export const COLUMNAS: { id: Columna; nombre: string }[] = [
  { id: "cocina", nombre: "En cocina" },
  { id: "listo", nombre: "Listo para salir" },
  { id: "camino", nombre: "En camino" },
  { id: "entregado", nombre: "Entregado" },
];

export function columnaDe(pedido: Pedido): Columna {
  if (pedido.estado === "ENTREGADO") return "entregado";
  if (pedido.estado === "EN_CAMINO") return "camino";
  if (pedido.estado === "LISTO") return "listo";
  return "cocina";
}

export const saldoDe = (pedido: Pedido): number => centimos(pedido.saldoPendiente);

export type TonoDePago = "pagado" | "por-confirmar" | "cobrar";

// El pago previsto, siempre con sus palabras: es lo que lee quien despacha
export function pagoEnPalabras(pedido: Pedido): { tono: TonoDePago; texto: string } {
  const saldo = soles(saldoDe(pedido));
  const previsto = pedido.pagoPrevisto;
  if (pedido.pagado) return { tono: "pagado", texto: "Pagado" };
  if (!previsto) return { tono: "cobrar", texto: `Cobrar ${saldo}` };
  const metodo = nombreDeMetodo(previsto.metodo);
  if (previsto.momento === "ANTICIPADO") return { tono: "por-confirmar", texto: `${metodo} por confirmar · ${saldo}` };
  if (previsto.metodo !== "EFECTIVO") return { tono: "cobrar", texto: `Cobrar ${saldo} por ${metodo} al entregar` };
  if (!previsto.pagaCon) return { tono: "cobrar", texto: `Cobrar ${saldo} en efectivo` };
  const pagaCon = soles(centimos(previsto.pagaCon));
  return {
    tono: "cobrar",
    texto: previsto.vuelto
      ? `Cobrar ${saldo} · paga con ${pagaCon} · vuelto ${soles(centimos(previsto.vuelto))}`
      : `Cobrar ${saldo} · paga con ${pagaCon}, que no alcanza`,
  };
}

// Entregados en contraentrega efectivo que el motorizado todavía no rindió
export const porRendir = (pedidos: Pedido[]): Pedido[] =>
  pedidos.filter(
    (p) =>
      p.tipo === "DELIVERY" &&
      p.estado === "ENTREGADO" &&
      !p.pagado &&
      p.pagoPrevisto?.momento === "AL_RECIBIR" &&
      p.pagoPrevisto.metodo === "EFECTIVO",
  );

// Celular peruano: 9 dígitos que empiezan con 9, con o sin el 51 delante
export function celular(telefono: string | null | undefined): string | null {
  const digitos = (telefono ?? "").replace(/\D/g, "").replace(/^51(?=\d{9}$)/, "");
  return /^9\d{8}$/.test(digitos) ? digitos : null;
}

// Sin número (motorizado sin teléfono), WhatsApp deja elegir el contacto
export const enlaceWhatsapp = (telefono: string | null | undefined, texto: string): string => {
  const numero = celular(telefono);
  return `https://wa.me/${numero ? `51${numero}` : ""}?text=${encodeURIComponent(texto)}`;
};

// La dirección sola no alcanza: el mapa necesita el distrito y la región
export const enlaceMaps = (pedido: Pedido, region: string | null): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [pedido.direccionEntrega, pedido.distritoEntrega, region].filter(Boolean).join(", "),
  )}`;

// Lo que el motorizado necesita para salir: a quién, dónde, cuánto cobrar y qué vuelto llevar
export function mensajeParaMotorizado(pedido: Pedido, region: string | null): string {
  const previsto = pedido.pagoPrevisto;
  const lineas = [
    `*Pedido #${pedido.numero}*`,
    `Cliente: ${pedido.cliente?.nombre ?? "sin nombre"}${pedido.cliente?.telefono ? ` · ${pedido.cliente.telefono}` : ""}`,
    `Dirección: ${[pedido.direccionEntrega, pedido.distritoEntrega].filter(Boolean).join(", ")}`,
  ];
  if (pedido.referenciaEntrega) lineas.push(`Referencia: ${pedido.referenciaEntrega}`);
  lineas.push(`Mapa: ${enlaceMaps(pedido, region)}`, "", `Total: ${soles(centimos(pedido.total))}`);
  if (pedido.pagado || previsto?.momento === "ANTICIPADO") {
    lineas.push("*Ya está pagado: no cobrar*");
  } else if (previsto?.metodo === "EFECTIVO" && previsto.pagaCon && previsto.vuelto) {
    lineas.push(
      `*Cobrar ${soles(saldoDe(pedido))} en efectivo*`,
      `Paga con ${soles(centimos(previsto.pagaCon))}: lleva ${soles(centimos(previsto.vuelto))} de vuelto`,
    );
  } else {
    const metodo: MetodoPago = previsto?.metodo ?? "EFECTIVO";
    lineas.push(`*Cobrar ${soles(saldoDe(pedido))}${metodo === "EFECTIVO" ? " en efectivo" : ` por ${nombreDeMetodo(metodo)}`}*`);
  }
  return lineas.join("\n");
}

export const mensajeParaCliente = (pedido: Pedido, negocio: string): string =>
  pedido.tipo === "DELIVERY"
    ? `Hola${pedido.cliente?.nombre ? ` ${pedido.cliente.nombre}` : ""}, tu pedido de ${negocio} ya salió y va en camino. Total: ${soles(centimos(pedido.total))}.`
    : `Hola${pedido.cliente?.nombre ? ` ${pedido.cliente.nombre}` : ""}, tu pedido de ${negocio} ya está listo para recoger. Total: ${soles(centimos(pedido.total))}.`;

// Para el buscador: sin tildes ni mayúsculas ("cevi" encuentra "Cevichería")
export const sinTildes = (texto: string): string =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
