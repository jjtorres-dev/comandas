// Tipos de la API (referencia: backend/docs/API.md)

export type Rol = "ADMIN" | "MOZO" | "LOCAL";

export type Usuario = {
  id: string;
  nombre: string;
  usuario: string;
  roles: Rol[];
};

export type Negocio = {
  id: string;
  codigo: string;
  nombre: string;
  logoUrl: string | null;
};

export type NegocioPublico = Pick<Negocio, "nombre" | "logoUrl">;

export type Sesion = { usuario: Usuario; negocio: Negocio };

export type RespuestaLogin = Sesion & { token: string };

// ---------- Carta ----------

export type Variante = { id: string; nombre: string; precio: string };

export type OpcionCombo = { productoId: string; nombre: string };

export type Producto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  imagenUrl: string | null;
  areaId: string;
  tapers: number;
  esCombo: boolean;
  comboCantidad: number | null;
  variantes: Variante[];
  opcionesCombo: OpcionCombo[];
};

export type Categoria = { id: string; nombre: string; productos: Producto[] };

export type NotaRapida = { id: string; texto: string };

// Área de preparación (cocina, bebidas…)
export type Area = { id: string; nombre: string };

// Lo que hace falta para tomar un pedido por teléfono y decirle el total al cliente
export type Reparto = { costoEnvioDefault: string; precioTaper: string; distritos: string[]; region: string | null };

export type Carta = { categorias: Categoria[]; notasRapidas: NotaRapida[]; areas: Area[]; reparto: Reparto };

// ---------- Pedidos y mesas ----------

export type TipoPedido = "MESA" | "DELIVERY" | "PARA_LLEVAR";
export type EstadoItem = "PENDIENTE" | "PREPARANDO" | "LISTO" | "ENTREGADO" | "CANCELADO";
export type EstadoPedido = EstadoItem | "EN_CAMINO";

export type ItemPedido = {
  id: string;
  varianteId: string;
  areaId: string;
  cantidad: number;
  estado: EstadoItem;
  nombreProducto: string;
  precioUnitario: string;
  notas: string[];
  componentes: string[];
  orden: number;
  idRonda: string;
  creadoEn: string;
  // Cuándo se marcó LISTO (null si todavía no)
  listoEn: string | null;
};

export type Pedido = {
  id: string;
  numero: number;
  tipo: TipoPedido;
  estado: EstadoPedido;
  mesa: { id: string; nombre: string } | null;
  // Volvió a quedar por cobrar con la mesa ya ocupada por otro pedido: no la ocupa
  mesaLiberada: boolean;
  mozo: { id: string; nombre: string };
  cliente: { nombre: string | null; telefono: string | null } | null;
  direccionEntrega: string | null;
  distritoEntrega: string | null;
  referenciaEntrega: string | null;
  repartidor: { id: string; nombre: string; telefono: string | null } | null;
  // Pedidos por teléfono: cómo va a pagar. No es un pago registrado.
  pagoPrevisto: PagoPrevisto | null;
  motivoCancelacion: string | null;
  nota: string | null;
  subtotal: string;
  costoEnvio: string;
  cargoTapers: string;
  cantidadTapers: number;
  tapersManual: boolean;
  descuento: string;
  total: string;
  totalPagado: string;
  saldoPendiente: string;
  pagado: boolean;
  creadoEn: string;
  items: ItemPedido[];
};

export type Mesa = {
  id: string;
  nombre: string;
  estado: "libre" | "ocupada";
  pedido: { id: string; numero: number; estado: EstadoPedido; total: string; creadoEn: string } | null;
};

// ---------- Caja ----------

export type MetodoPago = "EFECTIVO" | "YAPE" | "PLIN" | "TARJETA";

export type Turno = {
  id: string;
  abierto: boolean;
  abiertoEn: string;
  abiertoPor: { id: string; nombre: string };
  cerradoEn: string | null;
  montoInicial: string;
  totalesPorMetodo: Record<MetodoPago, string>;
  totalCobrado: string;
  pedidosCobrados: number;
  pagosAnulados: number;
  vueltoEntregado: string;
  efectivoEsperado: string;
  efectivoContado: string | null;
  diferencia: string | null;
  observacion: string | null;
};

export type PagoRegistrado = {
  id: string;
  metodo: MetodoPago;
  monto: string;
  recibido: string | null;
  vuelto: string;
  referencia: string | null;
  itemIds: string[];
  creadoEn: string;
  anulado: boolean;
  anuladoEn: string | null;
  anuladoPor: { id: string; nombre: string } | null;
  motivoAnulacion: string | null;
  // Solo en la cuenta: vigente y del turno abierto
  corregible?: boolean;
};

export type ItemDeCuenta = {
  id: string;
  nombreProducto: string;
  componentes: string[];
  cantidad: number;
  precioUnitario: string;
  subtotal: string;
  cantidadPagada: number;
  pagado: boolean;
};

export type Cuenta = {
  pedidoId: string;
  numero: number;
  tipo: TipoPedido;
  items: ItemDeCuenta[];
  subtotal: string;
  costoEnvio: string;
  cantidadTapers: number;
  cargoTapers: string;
  descuento: string;
  total: string;
  totalPagado: string;
  saldoPendiente: string;
  pagado: boolean;
  pagos: PagoRegistrado[];
};

// Un pedido con pagos en el turno abierto
export type Cobrado = {
  pedido: {
    id: string;
    numero: number;
    tipo: TipoPedido;
    mesa: { id: string; nombre: string } | null;
    cliente: { nombre: string | null; telefono: string | null } | null;
    total: string;
    totalPagado: string;
    saldoPendiente: string;
    pagado: boolean;
  };
  pagos: PagoRegistrado[];
  ultimoPagoEn: string;
};

export type CierreDeCaja = {
  turno: Turno;
  pedidosConPagoParcial: { id: string; numero: number; total: string; totalPagado: string; saldoPendiente: string }[];
  aviso: string | null;
};

// ---------- Delivery ----------

export type MomentoPago = "ANTICIPADO" | "AL_RECIBIR";

export type PagoPrevisto = {
  momento: MomentoPago;
  metodo: MetodoPago;
  // Efectivo al recibir: con cuánto paga y el vuelto que debe llevar el motorizado
  pagaCon: string | null;
  vuelto: string | null;
};

export type ClienteGuardado = {
  id: string;
  telefono: string;
  nombre: string | null;
  direccion: string | null;
  distrito: string | null;
  referencia: string | null;
};

export type Repartidor = { id: string; nombre: string; telefono: string | null };
