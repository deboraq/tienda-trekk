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
}
