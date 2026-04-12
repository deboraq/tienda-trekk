export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image: string;
  category?: string;
  /** Entero ≥ 0. Ausente = sin tope en la web (productos viejos). */
  stock?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

/**
 * Tras modificar ítems del pedido, el cliente logueado debe aceptar o rechazar en «Mi cuenta».
 * `no_aplica` = pedido sin cambios desde el alta o ya confirmado sin ediciones nuevas.
 */
export type ConfirmacionModificacion =
  | "no_aplica"
  | "pendiente"
  | "aceptada"
  | "rechazada";

/** Estados del pedido (Firestore + UI). El admin los actualiza desde el panel. */
export type PedidoEstado =
  | "recibido"
  | "en_preparacion"
  | "enviado"
  | "entregado"
  | "cancelado";

export interface PedidoLineItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Pedido {
  id: string;
  userId: string;
  userEmail: string;
  /** WhatsApp del cliente (solo dígitos, ej. 549…). Para avisos desde el panel. */
  clientPhone?: string;
  items: PedidoLineItem[];
  total: number;
  status: PedidoEstado;
  createdAt: Date | null;
  /** Última vez que la tienda tocó el pedido (estado, ítems, etc.). Ausente en pedidos muy viejos. */
  updatedAt: Date | null;
  /**
   * Si es true, las unidades del pedido ya se descontaron del stock del catálogo.
   * Se activa al pasar de «recibido» a en preparación / enviado / entregado (o se sella en pedidos antiguos).
   */
  stockCommitted?: boolean;
  /** Si la tienda cambió el pedido respecto al pedido original y el cliente debe responder. */
  confirmacionModificacion?: ConfirmacionModificacion;
}
