export interface ProductoStock {
  cantidad_disponible: number;
  cantidad_reservada: number;
}

export interface Producto {
  id_producto: string;
  nombre: string;
  tipo: string;
  stock: ProductoStock;
  atributos: Record<string, unknown>;
  activo: boolean;
  fecha_creacion: Date;
  fecha_actualizacion: Date;
}

export interface TrazabilidadInventario {
  id_trazabilidad: string;
  fecha_hora: Date;
  id_producto: string;
  nombre_responsable: string;
}

export interface CreateProductoRequest {
  id_producto?: unknown;
  nombre?: unknown;
  tipo?: unknown;
  stock?: unknown;
  atributos?: unknown;
  nombre_responsable?: unknown;
}

export interface UpdateProductoRequest {
  nombre?: unknown;
  tipo?: unknown;
  stock?: unknown;
  atributos?: unknown;
  activo?: unknown;
  nombre_responsable?: unknown;
}

export interface ProductoMutationData {
  producto: Producto;
  nombreResponsable: string;
}

export interface ProductoUpdateFields {
  nombre?: string;
  tipo?: string;
  stock?: ProductoStock;
  atributos?: Record<string, unknown>;
  activo?: boolean;
}

export interface PedidoProducto {
  id_producto: string;
  cantidad: number;
}

export interface Pedido {
  id_pedido: string;
  productos: PedidoProducto[];
}

export interface PedidoCreadoEvent {
  evento: 'pedido_creado';
  pedido: Pedido;
}

export interface StockEvaluadoEvent {
  evento: 'stock_aprobado' | 'stock_rechazado';
  ocurrido_en: string;
  pedido: Pedido;
  productos: Array<{
    id_producto: string;
    cantidad_solicitada: number;
    cantidad_disponible: number;
    aprobado: boolean;
    motivo?: string;
  }>;
}

