"use client";

import type { VistaTienda } from "../../lib/brand";
import { IconCart, IconGrid, IconHeart, IconHome, IconUser } from "./Icons";

type Props = {
  vista: VistaTienda;
  totalItems: number;
  notifMiCuenta: number;
  onInicio: () => void;
  onCatalogo: () => void;
  onFavoritos: () => void;
  onCart: () => void;
  onAccount: () => void;
};

export function BottomNav({
  vista,
  totalItems,
  notifMiCuenta,
  onInicio,
  onCatalogo,
  onFavoritos,
  onCart,
  onAccount,
}: Props) {
  const itemClass = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 font-heading text-[9px] font-bold uppercase tracking-[0.12em] ${
      active ? "text-[#E2781E]" : "text-white/55"
    }`;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#1D1B19]/95 backdrop-blur md:hidden">
      <div className="flex">
        <button type="button" onClick={onInicio} className={itemClass(vista === "inicio")}>
          <IconHome />
          Inicio
        </button>
        <button type="button" onClick={onCatalogo} className={itemClass(vista === "catalogo")}>
          <IconGrid />
          Catálogo
        </button>
        <button type="button" onClick={onFavoritos} className={itemClass(vista === "favoritos")}>
          <IconHeart filled={vista === "favoritos"} />
          Favoritos
        </button>
        <button type="button" onClick={onCart} className={`${itemClass(false)} relative`}>
          <span className="relative">
            <IconCart className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -right-2 -top-1 rounded-full bg-[#E2781E] px-1 font-heading text-[9px] text-black">
                {totalItems}
              </span>
            )}
          </span>
          Carrito
        </button>
        <button type="button" onClick={onAccount} className={`${itemClass(false)} relative`}>
          <span className="relative">
            <IconUser />
            {notifMiCuenta > 0 && (
              <span className="absolute -right-2 -top-1 rounded-full bg-[#E2781E] px-1 font-heading text-[9px] text-black">
                {notifMiCuenta}
              </span>
            )}
          </span>
          Perfil
        </button>
      </div>
    </nav>
  );
}
