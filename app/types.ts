export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image: string;
  category?: string;
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
  items: PedidoLineItem[];
  total: number;
  status: PedidoEstado;
  createdAt: Date | null;
}
