// Cómo se arma el panel de cocina a partir de los pedidos activos. Funciones
// puras: reciben los pedidos del servidor y devuelven qué mostrar.
import type { Area, EstadoItem, ItemPedido, Pedido } from "../lib/tipos";

// Minutos a partir de los cuales una comanda "Tarda" y va "Muy tarde".
// Hoy son fijos; están aquí para volverse configuración del negocio.
export const UMBRALES = { tarda: 15, muyTarde: 25 };

export type Tardanza = "a-tiempo" | "tarda" | "muy-tarde";

export function tardanzaDe(desde: string, ahora: number): { minutos: number; nivel: Tardanza } {
  const minutos = Math.max(0, Math.floor((ahora - new Date(desde).getTime()) / 60_000));
  return { minutos, nivel: minutos >= UMBRALES.muyTarde ? "muy-tarde" : minutos >= UMBRALES.tarda ? "tarda" : "a-tiempo" };
}

const porHacer = (item: ItemPedido) => item.estado === "PENDIENTE" || item.estado === "PREPARANDO";

export type Grupo = { area: Area; items: ItemPedido[] };

export type Bloque = {
  idRonda: string;
  // 1, 2, 3… dentro del pedido completo
  numero: number;
  // Nadie la empezó todavía: todos sus platos siguen PENDIENTE
  nueva: boolean;
  grupos: Grupo[];
};

export type Comanda = {
  pedido: Pedido;
  // Rondas con platos por preparar
  bloques: Bloque[];
  // Rondas anteriores que ya no tienen nada por preparar (solo su número)
  rondasHechas: number[];
  // Cuántas rondas tiene el pedido en total: con una sola no se nombra la ronda
  totalRondas: number;
  // Llegada de la ronda más antigua con platos por preparar: ordena la fila y pinta la tardanza
  desde: string;
  // Todos los platos por preparar (del área filtrada)
  porHacer: ItemPedido[];
};

export type Listo = { pedido: Pedido; items: ItemPedido[]; desde: string };

const SIN_AREA: Area = { id: "", nombre: "Otros" };

// areaId = null muestra todas las áreas
export function armarPanel(pedidos: Pedido[], areas: Area[], areaId: string | null): { comandas: Comanda[]; listos: Listo[] } {
  const comandas: Comanda[] = [];
  const listos: Listo[] = [];

  for (const pedido of pedidos) {
    // El número de ronda sale del pedido completo, no de lo filtrado
    const idsDeRonda = [...new Set(pedido.items.map((i) => i.idRonda))];
    const visibles = pedido.items.filter((i) => i.estado !== "CANCELADO" && (areaId === null || i.areaId === areaId));
    const pendientes = visibles.filter(porHacer);

    if (pendientes.length === 0) {
      const items = visibles.filter((i) => i.estado === "LISTO");
      // Un delivery que ya salió no se puede "deshacer" desde la cocina
      if (items.length > 0 && pedido.estado !== "EN_CAMINO") {
        listos.push({ pedido, items, desde: items.reduce((min, i) => (i.creadoEn < min ? i.creadoEn : min), items[0].creadoEn) });
      }
      continue;
    }

    const bloques: Bloque[] = [];
    const rondasHechas: number[] = [];
    idsDeRonda.forEach((idRonda, indice) => {
      const deRonda = visibles.filter((i) => i.idRonda === idRonda);
      if (deRonda.length === 0) return;
      if (!deRonda.some(porHacer)) return void rondasHechas.push(indice + 1);

      const grupos: Grupo[] = [];
      for (const item of deRonda) {
        const area = areas.find((a) => a.id === item.areaId) ?? SIN_AREA;
        const grupo = grupos.find((g) => g.area.id === area.id);
        if (grupo) grupo.items.push(item);
        else grupos.push({ area, items: [item] });
      }
      // Las áreas siempre en el mismo orden (el de la carta)
      grupos.sort((a, b) => areas.indexOf(a.area) - areas.indexOf(b.area));
      bloques.push({ idRonda, numero: indice + 1, nueva: deRonda.every((i) => i.estado === "PENDIENTE"), grupos });
    });

    const desde = bloques
      .flatMap((b) => b.grupos.flatMap((g) => g.items))
      .reduce((min, i) => (i.creadoEn < min ? i.creadoEn : min), pendientes[0].creadoEn);
    comandas.push({ pedido, bloques, rondasHechas, totalRondas: idsDeRonda.length, desde, porHacer: pendientes });
  }

  comandas.sort((a, b) => a.desde.localeCompare(b.desde));
  // Lo último que se marcó listo queda arriba
  listos.reverse();
  return { comandas, listos };
}

// Rondas que nadie empezó (del área filtrada): son las que hacen sonar el aviso
export function rondasSinEmpezar(comandas: Comanda[]): { clave: string; pedidoId: string }[] {
  return comandas.flatMap((c) => c.bloques.filter((b) => b.nueva).map((b) => ({ clave: `${c.pedido.id}:${b.idRonda}`, pedidoId: c.pedido.id })));
}

// Qué estado sigue al tocar "Empezar" o "Listo" sobre un conjunto de platos
export const paraEmpezar = (items: ItemPedido[]) => items.filter((i) => i.estado === "PENDIENTE");
export const paraListo = (items: ItemPedido[]) => items.filter(porHacer);

export type Previos = Record<string, EstadoItem>;

export const nombreDeTipo = (pedido: Pedido): string =>
  pedido.tipo === "MESA"
    ? (pedido.mesa?.nombre ?? "Mesa")
    : `${pedido.tipo === "DELIVERY" ? "Delivery" : "Para llevar"}${pedido.cliente?.nombre ? ` · ${pedido.cliente.nombre}` : ""}`;
