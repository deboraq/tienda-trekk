"use client";

import Image from "next/image";
import type { User } from "firebase/auth";
import { NAV_DESKTOP, type NavClave, type VistaTienda } from "../../lib/brand";
import {
  IconCart,
  IconHeart,
  IconSearch,
  IconUser,
  IconWhatsApp,
} from "./Icons";

type Props = {
  vista: VistaTienda;
  busqueda: string;
  onBusqueda: (value: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  totalItems: number;
  notifMiCuenta: number;
  usuarioTienda: User | null;
  onNav: (id: NavClave) => void;
  onCart: () => void;
  onAccount: () => void;
  onWhatsApp: () => void;
  onHelp: () => void;
  onFavoritos: () => void;
};

export function StoreHeader({
  vista,
  busqueda,
  onBusqueda,
  searchRef,
  totalItems,
  notifMiCuenta,
  usuarioTienda,
  onNav,
  onCart,
  onAccount,
  onWhatsApp,
  onHelp,
  onFavoritos,
}: Props) {
  return (
    <header className="sticky top-0 z-50">
      <div className="hidden bg-[#1d1b19] px-4 py-2 md:block">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
          <div className="flex items-center gap-3 font-heading text-[13px] font-semibold uppercase tracking-[0.14em]">
            <span className="inline-flex items-center gap-2 text-[#E2781E]">
              <span className="h-2 w-2 rounded-full bg-[#E2781E]" aria-hidden />
              Envíos a todo el país
            </span>
            <span className="text-white/35">·</span>
            <span className="text-white/70">10% OFF vía transferencia</span>
            <span className="text-white/35">·</span>
            <span className="text-white/70">Asesoramiento técnico en vivo</span>
          </div>
          <div className="flex items-center gap-5 font-heading text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden>🇦🇷</span> ARG (ARS $)
            </span>
            <button type="button" onClick={onHelp} className="hover:text-white">
              Centro de Ayuda
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#2C2926]">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 md:grid md:grid-cols-[1fr_28rem_1fr] md:gap-4">
          <button type="button" onClick={() => onNav("inicio")} className="flex shrink-0 items-center gap-3 text-left">
            <Image
              src="/brand/isotipo-oficial.png"
              alt="Sangre Nómade"
              width={80}
              height={80}
              className="h-14 w-14 shrink-0 object-contain md:h-16 md:w-16"
              priority
            />
            <span className="flex flex-col justify-center gap-1.5">
              <span className="block font-heading text-lg font-bold uppercase leading-none tracking-[0.04em] text-[#F4F0EA] md:text-[1.65rem]">
                Sangre Nómade
              </span>
              <span
                className="hidden whitespace-nowrap font-heading text-[13px] font-bold uppercase leading-none text-[#E8B892] md:block"
                style={{ letterSpacing: "0.38em" }}
              >
                Outdoor & Trekking · Córdoba
              </span>
              <span className="block font-heading text-[9px] uppercase tracking-[0.16em] text-[#E2781E] md:hidden">
                {vista === "catalogo" ? "Catálogo" : vista === "favoritos" ? "Favoritos" : "Inicio"}
              </span>
            </span>
          </button>

          <div className="hidden md:block">
            <label className="flex h-14 w-full items-center gap-2.5 rounded-md border border-white/12 bg-[#1a1714] px-2.5">
              <span className="shrink-0 text-white/40">
                <IconSearch className="h-[18px] w-[18px]" />
              </span>
              <input
                ref={searchRef}
                type="search"
                value={busqueda}
                onChange={(e) => onBusqueda(e.target.value)}
                placeholder="Buscar camperas 3L, calzado Vibram, equipo..."
                className="h-10 min-w-0 flex-1 rounded-[3px] border border-white/18 bg-transparent px-3 text-[13px] text-[#D1D5DB] outline-none placeholder:text-white/38 focus:border-white/30 [&::-webkit-search-cancel-button]:hidden"
                aria-label="Buscar productos"
              />
            </label>
          </div>

          <div className="ml-auto flex items-center justify-end gap-1.5 md:ml-0 md:gap-2">
            <button
              type="button"
              className="md:hidden rounded-md p-2 text-white/80 hover:bg-white/10"
              onClick={() => {
                const el = document.getElementById("busqueda-movil");
                el?.classList.toggle("hidden");
                (el?.querySelector("input") as HTMLInputElement | null)?.focus();
              }}
              aria-label="Buscar"
            >
              <IconSearch className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={onWhatsApp}
              className="hidden items-center gap-2 rounded-md border border-white/10 bg-[#1d1b19] px-3 py-2 font-heading text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:border-[#25d366]/40 lg:inline-flex"
            >
              <IconWhatsApp className="h-4 w-4 text-[#25d366]" />
              WhatsApp técnico
            </button>
            <button
              type="button"
              onClick={onFavoritos}
              className="hidden rounded-md p-2 text-white/80 hover:bg-white/10 md:inline-flex"
              aria-label="Favoritos"
            >
              <IconHeart />
            </button>
            <button
              type="button"
              onClick={onAccount}
              className="relative hidden rounded-md p-2 text-white/80 hover:bg-white/10 md:inline-flex"
              aria-label={usuarioTienda ? "Mi cuenta" : "Iniciar sesión"}
            >
              <IconUser />
              {usuarioTienda && notifMiCuenta > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E2781E] px-1 font-heading text-[9px] font-bold text-black">
                  {notifMiCuenta > 9 ? "9+" : notifMiCuenta}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onCart}
              className="inline-flex items-center gap-2 rounded-md bg-[#E2781E] px-2.5 py-2 font-heading text-[11px] font-bold uppercase tracking-[0.12em] text-black hover:bg-[#C96614] md:px-3"
              aria-label={`Carrito, ${totalItems} productos`}
            >
              <IconCart className="h-4 w-4" />
              <span className="hidden sm:inline">Carrito</span>
              <span className="rounded bg-black/15 px-1.5 py-0.5 tabular-nums">{totalItems}</span>
            </button>
          </div>
        </div>

        <div id="busqueda-movil" className="hidden border-t border-white/10 px-3 py-2 md:hidden">
          <input
            type="search"
            value={busqueda}
            onChange={(e) => onBusqueda(e.target.value)}
            placeholder="Buscar prenda, modelo o accesorio..."
            className="h-10 w-full rounded-md border border-white/10 bg-[#1d1b19] px-3 text-sm text-[#D1D5DB] outline-none placeholder:text-white/35"
          />
        </div>

        <nav className="hidden border-t border-white/[0.04] bg-gradient-to-b from-[#241f1b] to-[#151311] md:block">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4">
            <div className="flex items-center gap-1">
              {NAV_DESKTOP.map((item) => {
                const highlight =
                  (item.id === "inicio" && vista === "inicio") ||
                  (item.id === "catalogo" && vista === "catalogo");
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNav(item.id)}
                    className={`relative px-3 py-3 font-heading text-[12px] font-bold uppercase tracking-[0.14em] transition-colors ${
                      highlight ? "text-[#E2781E]" : "text-white/75 hover:text-white"
                    }`}
                  >
                    {item.label}
                    {highlight && (
                      <span className="absolute inset-x-3 bottom-0 h-[2px] bg-[#E2781E]" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="hidden items-center gap-2 font-heading text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45 lg:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E2781E]" />
              Expedition tested · Sierras & Andes
            </p>
          </div>
        </nav>
      </div>

      <div className="overflow-hidden bg-[#E2781E] py-1.5 md:hidden">
        <div className="sn-marquee-track font-heading text-[10px] font-bold uppercase tracking-[0.14em] text-black">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="shrink-0 whitespace-nowrap px-6">
              Córdoba, ARG · Envíos a todo el país · Asesoramiento técnico
            </span>
          ))}
        </div>
      </div>
    </header>
  );
}
