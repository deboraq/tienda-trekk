"use client";

import type { CartItem } from "../../types";
import { formatARS } from "../../lib/brand";

type Props = {
  open: boolean;
  carrito: CartItem[];
  totalPrecio: number;
  telefonoCheckout: string;
  setTelefonoCheckout: (v: string) => void;
  avisoCheckout: string | null;
  usuarioTienda: boolean;
  finalizandoPedido: boolean;
  onClose: () => void;
  onCantidad: (id: string, delta: number) => void;
  onEliminar: (id: string) => void;
  onFinalizar: () => void;
};

export function CartDrawer({
  open,
  carrito,
  totalPrecio,
  telefonoCheckout,
  setTelefonoCheckout,
  avisoCheckout,
  usuarioTienda,
  finalizandoPedido,
  onClose,
  onCantidad,
  onEliminar,
  onFinalizar,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-x-3 top-[4.5rem] z-[60] rounded-lg border border-white/10 bg-[#1D1B19] p-4 shadow-2xl md:inset-x-auto md:right-4 md:w-[24rem]"
      role="dialog"
      aria-labelledby="carrito-titulo"
    >
      <div className="mb-4 flex items-start justify-between border-b border-white/8 pb-3">
        <div>
          <p className="font-heading text-[10px] uppercase tracking-[0.16em] text-[#E2781E]">Sangre Nómade</p>
          <h2 id="carrito-titulo" className="font-heading text-lg font-bold uppercase tracking-wide text-white">
            Tu pedido
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white/50 hover:text-white"
          aria-label="Cerrar carrito"
        >
          ✕
        </button>
      </div>
      <div className="mb-4 max-h-56 space-y-2 overflow-y-auto">
        {carrito.length === 0 ? (
          <p className="py-6 text-center text-sm text-white/40">Tu carrito está vacío.</p>
        ) : (
          carrito.map((item) => (
            <div key={item.product.id} className="flex items-start justify-between gap-2 rounded-md border border-white/8 bg-[#151311] px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <span className="block font-medium text-white">{item.product.name}</span>
                <div className="mt-1.5 flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white"
                    onClick={() => onCantidad(item.product.id, -1)}
                  >
                    −
                  </button>
                  <span className="w-7 text-center font-heading font-bold text-white">{item.quantity}</span>
                  <button
                    type="button"
                    disabled={typeof item.product.stock === "number" && item.quantity >= item.product.stock}
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-white/10 text-white disabled:opacity-30"
                    onClick={() => onCantidad(item.product.id, 1)}
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-heading font-bold text-[#E68C24]">
                  ${formatARS(item.product.price * item.quantity)}
                </span>
                <button type="button" onClick={() => onEliminar(item.product.id)} className="text-xs text-white/45 hover:text-[#E2781E]">
                  Quitar
                </button>
              </div>
            </div>
          ))
        )}
      </div>
      {carrito.length > 0 && (
        <>
          <div className="mb-3 rounded-md border border-[#E2781E]/25 bg-[#E2781E]/10 px-3 py-2.5">
            <p className="font-heading text-xs uppercase tracking-wider text-white/60">Total estimado</p>
            <p className="font-heading text-2xl font-bold text-white">${formatARS(totalPrecio)}</p>
            <p className="text-[11px] text-[#E68C24]">
              C/transferencia: ${formatARS(Math.round(totalPrecio * 0.9))} (−10%)
            </p>
          </div>
          <label className="mb-3 block text-left">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#E2781E]">
              Tu WhatsApp <span className="text-red-400">*</span>
            </span>
            <input
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={telefonoCheckout}
              onChange={(e) => setTelefonoCheckout(e.target.value)}
              placeholder="Ej. +54 9 351 123-4567"
              className="mt-1.5 w-full rounded-md border border-white/10 bg-[#151311] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#E2781E]"
            />
          </label>
          {avisoCheckout && (
            <div className="mb-3 rounded-md border border-[#E2781E]/30 bg-[#E2781E]/10 px-3 py-3 text-xs text-[#E68C24]" role="alert">
              {avisoCheckout}
            </div>
          )}
          {!usuarioTienda && (
            <p className="mb-3 text-xs text-white/50">
              Para que el pedido quede en la nube, iniciá sesión antes de enviar.
            </p>
          )}
          <button
            type="button"
            onClick={onFinalizar}
            disabled={finalizandoPedido}
            className="w-full rounded-md bg-[#E2781E] py-3 font-heading text-sm font-bold uppercase tracking-wide text-black hover:bg-[#C96614] disabled:opacity-55"
          >
            {finalizandoPedido ? "Guardando…" : "Enviar por WhatsApp"}
          </button>
        </>
      )}
    </div>
  );
}
