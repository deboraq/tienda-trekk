"use client";

import { useEffect, useMemo, useState } from "react";
import type { Pedido, PedidoLineItem, Product } from "../types";
import { formatARS } from "../lib/brand";

const MOTIVOS = [
  "Falta de stock en bodega",
  "Cambio de talle / modelo solicitado por cliente",
  "Ajuste de común acuerdo por WhatsApp",
] as const;

type Props = {
  pedido: Pedido | null;
  productos: Product[];
  open: boolean;
  guardando: boolean;
  onClose: () => void;
  onGuardar: (opts: {
    items: PedidoLineItem[];
    motivo: string;
    notificar: boolean;
  }) => Promise<void>;
};

function recalc(line: PedidoLineItem): PedidoLineItem {
  return { ...line, lineTotal: line.unitPrice * line.quantity };
}

export function ModalModificarPedido({
  pedido,
  productos,
  open,
  guardando,
  onClose,
  onGuardar,
}: Props) {
  const [items, setItems] = useState<PedidoLineItem[]>([]);
  const [motivo, setMotivo] = useState<string>(MOTIVOS[0]);
  const [notificar, setNotificar] = useState(true);
  const [productoId, setProductoId] = useState("");

  useEffect(() => {
    if (!open || !pedido) return;
    setItems(pedido.items.map((i) => recalc({ ...i })));
    setMotivo(pedido.motivoModificacion && MOTIVOS.includes(pedido.motivoModificacion as (typeof MOTIVOS)[number])
      ? pedido.motivoModificacion
      : MOTIVOS[0]);
    setNotificar(true);
    setProductoId("");
  }, [open, pedido]);

  const totalAnterior = pedido?.total ?? 0;
  const nuevoTotal = useMemo(
    () => items.reduce((s, i) => s + i.lineTotal, 0),
    [items]
  );
  const diferencia = nuevoTotal - totalAnterior;

  if (!open || !pedido) return null;

  const actualizarCantidad = (index: number, delta: number) => {
    setItems((prev) => {
      const next = [...prev];
      const qty = Math.max(1, next[index].quantity + delta);
      next[index] = recalc({ ...next[index], quantity: qty });
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-[240] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1D1B19] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-modificar-pedido-title"
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] bg-[#151311] px-6 py-4">
          <div className="min-w-0">
            <p className="font-heading text-[10px] font-bold uppercase tracking-widest text-[#E2781E]">
              Sangre Nómade · Gestión comercial
            </p>
            <h2
              id="modal-modificar-pedido-title"
              className="mt-0.5 truncate font-heading text-sm font-bold uppercase tracking-wide text-white"
            >
              Modificar pedido #{pedido.id} · {pedido.userEmail}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/5 p-2 text-[#9CA3AF] hover:text-white"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-6">
          <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-[#151311] p-3.5 text-xs text-[#D1D5DB]">
            <span className="text-base leading-none text-[#E2781E]" aria-hidden>
              ⓘ
            </span>
            <p>
              Ajustá los ítems según disponibilidad de stock o solicitud del cliente. El cliente recibirá aviso en «Mi cuenta» para confirmar los cambios.
            </p>
          </div>

          <div className="space-y-3">
            {items.map((item, idx) => (
              <div
                key={`${item.productId}-${idx}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#151311] p-3.5"
              >
                <div className="min-w-0">
                  <h4 className="font-heading text-xs font-bold uppercase text-white">{item.name}</h4>
                  <p className="text-[11px] text-[#E2781E]">${formatARS(item.unitPrice)} c/u</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex overflow-hidden rounded-lg border border-white/10 bg-[#1D1B19]">
                    <button
                      type="button"
                      onClick={() => actualizarCantidad(idx, -1)}
                      className="px-2.5 py-1 text-xs font-bold text-[#D1D5DB] hover:bg-white/10"
                    >
                      −
                    </button>
                    <span className="min-w-[2rem] px-2 py-1 text-center text-xs font-bold text-white">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => actualizarCantidad(idx, 1)}
                      className="px-2.5 py-1 text-xs font-bold text-[#D1D5DB] hover:bg-white/10"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-20 text-right text-xs font-bold text-white">
                    ${formatARS(item.lineTotal)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1 text-red-400 hover:text-red-300"
                    title="Quitar producto"
                    aria-label={`Quitar ${item.name}`}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}

            {productos.length > 0 ? (
              <label className="relative flex h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-white/25 text-[#C4B5A5] hover:border-[#E2781E]/45 hover:text-[#E8A882]">
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[11px] font-bold leading-none"
                  aria-hidden
                >
                  +
                </span>
                <span className="font-heading text-[11px] font-bold uppercase tracking-wide">
                  + Agregar producto del catálogo
                </span>
                <select
                  value={productoId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setProductoId("");
                    const prod = productos.find((x) => x.id === id);
                    if (!prod) return;
                    setItems((prev) => {
                      const idx = prev.findIndex((l) => l.productId === prod.id);
                      if (idx >= 0) {
                        const next = [...prev];
                        next[idx] = recalc({ ...next[idx], quantity: next[idx].quantity + 1 });
                        return next;
                      }
                      return [
                        ...prev,
                        recalc({
                          productId: prod.id,
                          name: prod.name,
                          quantity: 1,
                          unitPrice: prod.price,
                          lineTotal: prod.price,
                        }),
                      ];
                    });
                  }}
                  className="absolute inset-0 cursor-pointer opacity-0"
                  aria-label="Agregar producto del catálogo"
                >
                  <option value="">Agregar producto del catálogo</option>
                  {productos.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name} (${formatARS(pr.price)})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-center text-[11px] text-[#9CA3AF]">
                No hay productos en el catálogo para agregar.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#151311] p-4">
            <p className="mb-2.5 font-heading text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
              Motivo del ajuste:
            </p>
            <div className="relative flex h-12 items-center overflow-hidden rounded-xl border border-white/10 bg-[#1D1B19]">
              <select
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="h-full w-full appearance-none bg-transparent px-4 pr-10 text-sm text-white outline-none"
              >
                {MOTIVOS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-3 h-4 w-4 text-[#9CA3AF]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-white/5 bg-[#151311] p-4">
            <div className="flex justify-between text-xs text-[#9CA3AF]">
              <span>Subtotal anterior registrado:</span>
              <span className="line-through">${formatARS(totalAnterior)}</span>
            </div>
            <div className="flex justify-between text-xs font-bold">
              <span className="text-[#D1D5DB]">Diferencia de saldo:</span>
              <span className={diferencia >= 0 ? "text-emerald-400" : "text-[#E2781E]"}>
                {diferencia >= 0
                  ? `+$${formatARS(diferencia)} (A favor tienda)`
                  : `-$${formatARS(Math.abs(diferencia))} (A favor cliente)`}
              </span>
            </div>
            <div className="flex items-baseline justify-between border-t border-white/10 pt-2">
              <span className="font-heading text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                Nuevo total recalculado
              </span>
              <span className="text-2xl font-black text-[#E2781E]">${formatARS(nuevoTotal)}</span>
            </div>
          </div>

          <label className="flex cursor-pointer items-start gap-2.5 text-xs text-[#D1D5DB]">
            <input
              type="checkbox"
              checked={notificar}
              onChange={(e) => setNotificar(e.target.checked)}
              className="mt-0.5 accent-[#E2781E]"
            />
            <span>
              Notificar al cliente en «Mi cuenta» y generar mensaje para WhatsApp con el comprobante actualizado.
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 border-t border-white/[0.08] bg-[#151311] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-heading text-xs font-bold uppercase text-[#D1D5DB] hover:bg-white/10 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando || items.length === 0}
            onClick={() => void onGuardar({ items, motivo, notificar })}
            className="rounded-lg bg-[#E2781E] px-5 py-2 font-heading text-xs font-bold uppercase text-black hover:bg-[#C96614] disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "✓ Guardar cambios y actualizar pedido"}
          </button>
        </div>
      </div>
    </div>
  );
}
