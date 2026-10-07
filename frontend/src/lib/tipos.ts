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

export type Carta = { categorias: Categoria[]; notasRapidas: NotaRapida[] };

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
};

export type Pedido = {
  id: string;
  numero: number;
  tipo: TipoPedido;
  estado: EstadoPedido;
  mesa: { id: string; nombre: string } | null;
  mozo: { id: string; nombre: string };
  cliente: { nombre: string | null; telefono: string | null } | null;
  nota: string | null;
  subtotal: string;
  cargoTapers: string;
  cantidadTapers: number;
  total: string;
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
