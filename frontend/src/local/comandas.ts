// Cómo se arma el panel de cocina a partir de los pedidos activos. Funciones
// puras: reciben los pedidos del servidor y devuelven qué mostrar.
import type { Area, EstadoItem, ItemPedido, Pedido, UmbralesCocina } from "../lib/tipos";

// Minutos a partir de los cuales una comanda "Tarda" y va "Muy tarde". Los
// fija el dueño (llegan con la carta); estos valen mientras la carta carga.
export const UMBRALES: UmbralesCocina = { tardaMin: 15, muyTardeMin: 25 };

export type Tardanza = "a-tiempo" | "tarda" | "muy-tarde";

export function tardanzaDe(desde: string, ahora: number, umbrales: UmbralesCocina = UMBRALES): { minutos: number; nivel: Tardanza } {
  const minutos = Math.max(0, Math.floor((ahora - new Date(desde).getTime()) / 60_000));
  return { minutos, nivel: minutos >= umbrales.muyTardeMin ? "muy-tarde" : minutos >= umbrales.tardaMin ? "tarda" : "a-tiempo" };
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
  // Solo quedan platos recién cancelados: la tarjeta se despide tachada
  cancelada: boolean;
};

// listoEn: cuándo quedó listo lo último de ese pedido
export type Listo = { pedido: Pedido; items: ItemPedido[]; listoEn: string };

const SIN_AREA: Area = { id: "", nombre: "Otros" };

const masAntiguo = (items: ItemPedido[]) => items.reduce((min, i) => (i.creadoEn < min ? i.creadoEn : min), items[0].creadoEn);

// areaId = null muestra todas las áreas. `tachados` son los platos recién
// cancelados: se siguen mostrando (tachados) unos segundos antes de desaparecer.
export function armarPanel(
  pedidos: Pedido[],
  areas: Area[],
  areaId: string | null,
  tachados: ReadonlySet<string> = new Set(),
): { comandas: Comanda[]; listos: Listo[] } {
  const comandas: Comanda[] = [];
  const listos: Listo[] = [];

  for (const pedido of pedidos) {
    // El número de ronda sale del pedido completo, no de lo filtrado
    const idsDeRonda = [...new Set(pedido.items.map((i) => i.idRonda))];
    const visibles = pedido.items.filter(
      (i) => (i.estado !== "CANCELADO" || tachados.has(i.id)) && (areaId === null || i.areaId === areaId),
    );
    const pendientes = visibles.filter(porHacer);
    const cancelados = visibles.filter((i) => i.estado === "CANCELADO");

    if (pendientes.length === 0 && cancelados.length === 0) {
      const items = visibles.filter((i) => i.estado === "LISTO");
      // Un delivery que ya salió no se puede "deshacer" desde la cocina
      if (items.length > 0 && pedido.estado !== "EN_CAMINO") {
        const horas = items.map((i) => i.listoEn ?? i.creadoEn);
        listos.push({ pedido, items, listoEn: horas.reduce((max, h) => (h > max ? h : max)) });
      }
      continue;
    }

    const bloques: Bloque[] = [];
    const rondasHechas: number[] = [];
    idsDeRonda.forEach((idRonda, indice) => {
      const deRonda = visibles.filter((i) => i.idRonda === idRonda);
      if (deRonda.length === 0) return;
      if (!deRonda.some((i) => porHacer(i) || i.estado === "CANCELADO")) return void rondasHechas.push(indice + 1);

      const grupos: Grupo[] = [];
      for (const item of deRonda) {
        const area = areas.find((a) => a.id === item.areaId) ?? SIN_AREA;
        const grupo = grupos.find((g) => g.area.id === area.id);
        if (grupo) grupo.items.push(item);
        else grupos.push({ area, items: [item] });
      }
      // Las áreas siempre en el mismo orden (el de la carta)
      grupos.sort((a, b) => areas.indexOf(a.area) - areas.indexOf(b.area));
      const vivos = deRonda.filter((i) => i.estado !== "CANCELADO");
      bloques.push({ idRonda, numero: indice + 1, nueva: vivos.length > 0 && vivos.every((i) => i.estado === "PENDIENTE"), grupos });
    });

    comandas.push({
      pedido,
      bloques,
      rondasHechas,
      totalRondas: idsDeRonda.length,
      desde: masAntiguo(pendientes.length > 0 ? pendientes : cancelados),
      porHacer: pendientes,
      cancelada: pendientes.length === 0,
    });
  }

  comandas.sort((a, b) => a.desde.localeCompare(b.desde));
  // Lo último que se marcó listo queda arriba
  listos.sort((a, b) => b.listoEn.localeCompare(a.listoEn));
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
    ? // Cuenta reabierta: se anuló un pago de un pedido ya pagado. Debe, pero ya no ocupa la mesa.
      `${pedido.mesa?.nombre ?? "Mesa"}${pedido.mesaLiberada ? " · cuenta reabierta" : ""}`
    : `${pedido.tipo === "DELIVERY" ? "Delivery" : "Para llevar"}${pedido.cliente?.nombre ? ` · ${pedido.cliente.nombre}` : ""}`;
