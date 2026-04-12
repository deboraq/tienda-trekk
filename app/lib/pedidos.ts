import type { User } from "firebase/auth";
import type {
  CartItem,
  ConfirmacionModificacion,
  Pedido,
  PedidoEstado,
  PedidoLineItem,
} from "../types";

export const PEDIDO_ESTADOS: PedidoEstado[] = [
  "recibido",
  "en_preparacion",
  "enviado",
  "entregado",
  "cancelado",
];

/** Flujo feliz (sin cancelado). El estado actual indica hasta qué paso llegó el pedido. */
export const PEDIDO_FLUJO_NORMAL: PedidoEstado[] = [
  "recibido",
  "en_preparacion",
  "enviado",
  "entregado",
];

/** Índice del estado en el flujo normal, o -1 si es cancelado. */
export function indiceEnFlujoNormal(status: PedidoEstado): number {
  if (status === "cancelado") return -1;
  const i = PEDIDO_FLUJO_NORMAL.indexOf(status);
  return i >= 0 ? i : 0;
}

export function etiquetaEstadoPedido(s: string): string {
  const m: Record<PedidoEstado, string> = {
    recibido: "Pedido recibido",
    en_preparacion: "En preparación",
    enviado: "Enviado",
    entregado: "Entregado",
    cancelado: "Cancelado",
  };
  return m[s as PedidoEstado] ?? s;
}

export function esEstadoPedido(v: string): v is PedidoEstado {
  return PEDIDO_ESTADOS.includes(v as PedidoEstado);
}

const CONFIRMACION_VALORES: ConfirmacionModificacion[] = [
  "no_aplica",
  "pendiente",
  "aceptada",
  "rechazada",
];

export function esConfirmacionModificacion(
  v: unknown
): v is ConfirmacionModificacion {
  return typeof v === "string" && CONFIRMACION_VALORES.includes(v as ConfirmacionModificacion);
}

/** Compara ítems del pedido (orden normalizado) para saber si la tienda los cambió. */
export function itemsPedidoDifieren(
  a: PedidoLineItem[],
  b: PedidoLineItem[]
): boolean {
  const norm = (items: PedidoLineItem[]) =>
    [...items]
      .sort((x, y) => x.productId.localeCompare(y.productId))
      .map((i) => ({
        productId: i.productId,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
      }));
  return JSON.stringify(norm(a)) !== JSON.stringify(norm(b));
}

export async function crearPedidoDesdeCarrito(
  user: User,
  carrito: CartItem[],
  total: number,
  clientPhone: string
): Promise<string> {
  await user.getIdToken(true);
  const email =
    (user.email ?? user.providerData[0]?.email ?? "").trim();
  const items: PedidoLineItem[] = carrito.map((ci) => ({
    productId: ci.product.id,
    name: ci.product.name,
    quantity: ci.quantity,
    unitPrice: ci.product.price,
    lineTotal: ci.product.price * ci.quantity,
  }));
  const { crearPedidoYReservarStock } = await import("./pedido-inventario");
  return crearPedidoYReservarStock({
    userId: user.uid,
    userEmail: email,
    clientPhone,
    items,
    total,
  });
}

export function docDataAPedido(
  id: string,
  data: Record<string, unknown>
): Pedido | null {
  const uid = data.userId;
  const email = data.userEmail;
  const itemsRaw = data.items;
  const total = data.total;
  const status = data.status;
  if (
    typeof uid !== "string" ||
    typeof email !== "string" ||
    !Array.isArray(itemsRaw) ||
    typeof total !== "number" ||
    typeof status !== "string"
  ) {
    return null;
  }
  if (!esEstadoPedido(status)) return null;

  let createdAt: Date | null = null;
  const ca = data.createdAt;
  if (
    ca &&
    typeof ca === "object" &&
    "toDate" in ca &&
    typeof (ca as { toDate: () => Date }).toDate === "function"
  ) {
    createdAt = (ca as { toDate: () => Date }).toDate();
  }

  let updatedAt: Date | null = null;
  const ua = data.updatedAt;
  if (
    ua &&
    typeof ua === "object" &&
    "toDate" in ua &&
    typeof (ua as { toDate: () => Date }).toDate === "function"
  ) {
    updatedAt = (ua as { toDate: () => Date }).toDate();
  }

  const items: PedidoLineItem[] = itemsRaw.map((raw) => {
    const o = raw as Record<string, unknown>;
    return {
      productId: String(o.productId ?? ""),
      name: String(o.name ?? ""),
      quantity: Number(o.quantity) || 0,
      unitPrice: Number(o.unitPrice) || 0,
      lineTotal: Number(o.lineTotal) || 0,
    };
  });

  const phoneRaw = data.clientPhone;
  const clientPhone =
    typeof phoneRaw === "string" && /^[0-9]{10,15}$/.test(phoneRaw)
      ? phoneRaw
      : undefined;

  const stockCommitted = data.stockCommitted === true;

  const confRaw = data.confirmacionModificacion;
  const confirmacionModificacion: ConfirmacionModificacion = esConfirmacionModificacion(
    confRaw
  )
    ? confRaw
    : "no_aplica";

  return {
    id,
    userId: uid,
    userEmail: email,
    clientPhone,
    items,
    total,
    status,
    createdAt,
    updatedAt,
    stockCommitted,
    confirmacionModificacion,
  };
}
