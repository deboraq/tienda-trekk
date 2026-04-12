import {
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  type Transaction,
} from "firebase/firestore";
import { getDb } from "../firebase/config";
import { stockDesdeFirestore } from "./product-stock";
import { esEstadoPedido } from "./pedidos";
import type { ConfirmacionModificacion, PedidoEstado, PedidoLineItem } from "../types";

/** Estados en los que el pedido ya “ocupa” unidades del catálogo (no pueden comprarse por otros). */
export function estadoComprometeStock(s: PedidoEstado): boolean {
  return (
    s === "en_preparacion" || s === "enviado" || s === "entregado"
  );
}

function cantidadesPorProducto(items: PedidoLineItem[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) {
    if (!it.productId) continue;
    m.set(it.productId, (m.get(it.productId) ?? 0) + it.quantity);
  }
  return m;
}

async function leerProductoStockTx(
  tx: Transaction,
  productId: string
): Promise<{
  ref: ReturnType<typeof doc>;
  stock: number | undefined;
  name: string;
}> {
  const ref = doc(getDb(), "productos", productId);
  const snap = await tx.get(ref);
  if (!snap.exists()) {
    throw new Error(
      `El producto «${productId}» ya no está en el catálogo. Revisá el pedido o restaurá el producto.`
    );
  }
  const data = snap.data() as Record<string, unknown>;
  return {
    ref,
    stock: stockDesdeFirestore(data.stock),
    name: String(data.name ?? productId),
  };
}

/** Descuenta unidades (solo productos con stock numérico). Todas las lecturas antes de escrituras. */
async function aplicarDescuentoItems(
  tx: Transaction,
  items: PedidoLineItem[]
): Promise<void> {
  const cant = cantidadesPorProducto(items);
  const pendientes: Array<{
    ref: ReturnType<typeof doc>;
    nuevoStock: number;
  }> = [];

  for (const [productId, qty] of cant) {
    if (qty <= 0) continue;
    const { ref, stock, name } = await leerProductoStockTx(tx, productId);
    if (stock === undefined) continue;
    if (stock < qty) {
      throw new Error(
        `Stock insuficiente para «${name}»: hay ${stock} y el pedido requiere ${qty}. Ajustá stock o el pedido.`
      );
    }
    pendientes.push({ ref, nuevoStock: stock - qty });
  }

  for (const p of pendientes) {
    tx.update(p.ref, { stock: p.nuevoStock });
  }
}

/** Devuelve unidades al catálogo (solo donde hay stock numérico). */
async function aplicarDevolucionItems(
  tx: Transaction,
  items: PedidoLineItem[]
): Promise<void> {
  const cant = cantidadesPorProducto(items);
  const pendientes: Array<{
    ref: ReturnType<typeof doc>;
    nuevoStock: number;
  }> = [];

  for (const [productId, qty] of cant) {
    if (qty <= 0) continue;
    const { ref, stock } = await leerProductoStockTx(tx, productId);
    if (stock === undefined) continue;
    pendientes.push({ ref, nuevoStock: stock + qty });
  }

  for (const p of pendientes) {
    tx.update(p.ref, { stock: p.nuevoStock });
  }
}

/**
 * Ajusta el inventario cuando cambian las líneas y el pedido ya tenía stock comprometido.
 * Actualiza el documento del pedido en la misma transacción.
 */
export async function actualizarInventarioPorCambioDeItemsPedido(opts: {
  pedidoId: string;
  itemsAnteriores: PedidoLineItem[];
  itemsNuevos: PedidoLineItem[];
  stockCommitted: boolean;
  /** Si la tienda cambió ítems respecto a lo guardado, el cliente debe confirmar. */
  marcarConfirmacionPendiente?: boolean;
}): Promise<void> {
  if (!opts.stockCommitted) return;

  const antes = cantidadesPorProducto(opts.itemsAnteriores);
  const despues = cantidadesPorProducto(opts.itemsNuevos);
  const ids = new Set([...antes.keys(), ...despues.keys()]);

  await runTransaction(getDb(), async (tx) => {
    const pedidoRef = doc(getDb(), "pedidos", opts.pedidoId);
    const pedSnap = await tx.get(pedidoRef);
    if (!pedSnap.exists()) throw new Error("El pedido no existe.");

    const deltas = new Map<string, number>();
    for (const productId of ids) {
      const qAnt = antes.get(productId) ?? 0;
      const qNue = despues.get(productId) ?? 0;
      const delta = qNue - qAnt;
      if (delta !== 0) deltas.set(productId, delta);
    }

    const pendientes: Array<{
      ref: ReturnType<typeof doc>;
      nuevoStock: number;
    }> = [];

    for (const [productId, delta] of deltas) {
      const { ref, stock, name } = await leerProductoStockTx(tx, productId);
      if (stock === undefined) continue;
      if (delta > 0 && stock < delta) {
        throw new Error(
          `No alcanza el stock para «${name}»: hay ${stock} y sumás ${delta} unidades más en el pedido.`
        );
      }
      pendientes.push({ ref, nuevoStock: stock - delta });
    }

    for (const p of pendientes) {
      tx.update(p.ref, { stock: p.nuevoStock });
    }

    tx.update(pedidoRef, {
      items: opts.itemsNuevos,
      total: opts.itemsNuevos.reduce((s, i) => s + i.lineTotal, 0),
      updatedAt: serverTimestamp(),
      ...(opts.marcarConfirmacionPendiente
        ? { confirmacionModificacion: "pendiente" }
        : {}),
    });
  });
}

export type ResultadoCambioEstadoInventario =
  | { ok: true; nuevoStockCommitted: boolean }
  | { ok: false; mensaje: string };

/**
 * Cambia el estado del pedido y mueve stock según reglas:
 * - De «recibido» a en preparación / enviado / entregado: descuenta una vez (stockCommitted).
 * - A «cancelado» o de vuelta a «recibido» desde un estado que comprometía: devuelve stock.
 * - Entre estados que ya comprometen (ej. en prep → enviado): solo actualiza estado.
 */
export async function cambiarEstadoPedidoConInventario(
  pedidoId: string,
  nuevoEstado: PedidoEstado
): Promise<ResultadoCambioEstadoInventario> {
  try {
    const resultado = await runTransaction(getDb(), async (tx) => {
      const pedidoRef = doc(getDb(), "pedidos", pedidoId);
      const pedSnap = await tx.get(pedidoRef);
      if (!pedSnap.exists()) {
        return { kind: "error" as const, mensaje: "Pedido no encontrado." };
      }
      const data = pedSnap.data() as Record<string, unknown>;
      const statusRaw = data.status;
      if (typeof statusRaw !== "string" || !esEstadoPedido(statusRaw)) {
        return { kind: "error" as const, mensaje: "Estado de pedido inválido." };
      }
      const estadoAnterior = statusRaw as PedidoEstado;
      if (estadoAnterior === nuevoEstado) {
        return {
          kind: "ok" as const,
          nuevoStockCommitted: data.stockCommitted === true,
        };
      }

      const confirmacionMod = data.confirmacionModificacion;
      if (
        confirmacionMod === "pendiente" &&
        estadoAnterior === "recibido" &&
        estadoComprometeStock(nuevoEstado)
      ) {
        return {
          kind: "error" as const,
          mensaje:
            "El cliente tiene que confirmar o rechazar el pedido modificado en «Mi cuenta» antes de ponerlo en preparación, enviarlo o marcarlo entregado.",
        };
      }

      const stockCommitted = data.stockCommitted === true;
      const itemsRaw = data.items;
      if (!Array.isArray(itemsRaw)) {
        return { kind: "error" as const, mensaje: "Ítems del pedido inválidos." };
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

      let nuevoCommitted = stockCommitted;

      if (nuevoEstado === "cancelado" && stockCommitted) {
        await aplicarDevolucionItems(tx, items);
        nuevoCommitted = false;
      } else if (
        nuevoEstado === "recibido" &&
        stockCommitted &&
        estadoComprometeStock(estadoAnterior)
      ) {
        await aplicarDevolucionItems(tx, items);
        nuevoCommitted = false;
      } else if (
        !stockCommitted &&
        estadoComprometeStock(nuevoEstado) &&
        estadoAnterior === "recibido"
      ) {
        await aplicarDescuentoItems(tx, items);
        nuevoCommitted = true;
      }

      /* Pedidos viejos ya en preparación/envío sin flag: no volvemos a descontar; solo marcamos. */
      if (estadoComprometeStock(nuevoEstado) && !nuevoCommitted) {
        nuevoCommitted = true;
      }

      tx.update(pedidoRef, {
        status: nuevoEstado,
        stockCommitted: nuevoCommitted,
        updatedAt: serverTimestamp(),
      });

      return { kind: "ok" as const, nuevoStockCommitted: nuevoCommitted };
    });

    if (resultado.kind === "error") {
      return { ok: false, mensaje: resultado.mensaje };
    }
    return {
      ok: true,
      nuevoStockCommitted: resultado.nuevoStockCommitted,
    };
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "No se pudo actualizar el inventario.";
    return { ok: false, mensaje: msg };
  }
}

/**
 * Crea el pedido en Firestore y descuenta stock en la misma transacción (reserva inmediata
 * para que otros clientes no vean esas unidades disponibles).
 */
export async function crearPedidoYReservarStock(opts: {
  userId: string;
  userEmail: string;
  clientPhone: string;
  items: PedidoLineItem[];
  total: number;
}): Promise<string> {
  const pedidoRef = doc(collection(getDb(), "pedidos"));

  await runTransaction(getDb(), async (tx) => {
    await aplicarDescuentoItems(tx, opts.items);

    tx.set(pedidoRef, {
      userId: opts.userId,
      userEmail: opts.userEmail,
      clientPhone: opts.clientPhone,
      items: opts.items,
      total: opts.total,
      status: "recibido",
      stockCommitted: true,
      confirmacionModificacion: "no_aplica" as ConfirmacionModificacion,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  return pedidoRef.id;
}
