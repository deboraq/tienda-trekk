import {
  FieldValue,
  type DocumentReference,
  type Firestore,
} from "firebase-admin/firestore";
import { stockDesdeFirestore } from "./product-stock";
import type { PedidoLineItem } from "../types";

function cantidadesPorProducto(items: PedidoLineItem[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    if (!it.productId) continue;
    m.set(it.productId, (m.get(it.productId) ?? 0) + it.quantity);
  }
  return m;
}

/**
 * Cliente rechaza el pedido modificado: cancela y devuelve stock si correspondía.
 */
export async function rechazarModificacionPedidoCliente(
  db: Firestore,
  pedidoId: string,
  uidCliente: string
): Promise<{ ok: true } | { ok: false; mensaje: string }> {
  try {
    await db.runTransaction(async (tx) => {
      const pedRef = db.collection("pedidos").doc(pedidoId);
      const pedSnap = await tx.get(pedRef);
      if (!pedSnap.exists) {
        throw new Error("Pedido no encontrado.");
      }
      const data = pedSnap.data()!;
      if (data.userId !== uidCliente) {
        throw new Error("No autorizado.");
      }
      if (data.confirmacionModificacion !== "pendiente") {
        throw new Error("Este pedido no está esperando tu confirmación.");
      }

      const itemsRaw = data.items;
      if (!Array.isArray(itemsRaw)) throw new Error("Ítems inválidos.");
      const items: PedidoLineItem[] = itemsRaw.map((raw: Record<string, unknown>) => ({
        productId: String(raw.productId ?? ""),
        name: String(raw.name ?? ""),
        quantity: Number(raw.quantity) || 0,
        unitPrice: Number(raw.unitPrice) || 0,
        lineTotal: Number(raw.lineTotal) || 0,
      }));

      const stockCommitted = data.stockCommitted === true;

      const pendientes: Array<{ ref: DocumentReference; nuevoStock: number }> =
        [];

      if (stockCommitted) {
        const cant = cantidadesPorProducto(items);
        for (const [productId, qty] of cant) {
          if (qty <= 0) continue;
          const prRef = db.collection("productos").doc(productId);
          const prSnap = await tx.get(prRef);
          if (!prSnap.exists) continue;
          const prData = prSnap.data() as Record<string, unknown>;
          const stock = stockDesdeFirestore(prData.stock);
          if (stock === undefined) continue;
          pendientes.push({ ref: prRef, nuevoStock: stock + qty });
        }
      }

      for (const p of pendientes) {
        tx.update(p.ref, { stock: p.nuevoStock });
      }

      tx.update(pedRef, {
        status: "cancelado",
        confirmacionModificacion: "rechazada",
        stockCommitted: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al rechazar el pedido.";
    return { ok: false, mensaje: msg };
  }
}
