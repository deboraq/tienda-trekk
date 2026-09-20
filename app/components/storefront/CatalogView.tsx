"use client";

import Image from "next/image";
import type { Product } from "../../types";
import { formatARS } from "../../lib/brand";
import { IconHeart } from "./Icons";
import { puedeAgregarUnidad, productoSinStock } from "../../lib/product-stock";

type Props = {
  titulo: string;
  categorias: string[];
  categoriaSeleccionada: string;
  setCategoria: (c: string) => void;
  busqueda: string;
  setBusqueda: (v: string) => void;
  searchRef?: React.RefObject<HTMLInputElement | null>;
  productos: Product[];
  carritoQty: (id: string) => number;
  onAdd: (p: Product) => void;
  onAmpliar: (src: string, alt: string) => void;
  favoritos: string[];
  onToggleFavorito: (id: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
};

export function CatalogView({
  titulo,
  categorias,
  categoriaSeleccionada,
  setCategoria,
  busqueda,
  setBusqueda,
  searchRef,
  productos,
  carritoQty,
  onAdd,
  onAmpliar,
  favoritos,
  onToggleFavorito,
  loading,
  error,
  onRetry,
}: Props) {
  return (
    <section className="mx-auto min-h-screen max-w-7xl px-4 py-8">
      <div className="mb-2 flex items-end justify-between gap-3">
        <h1 className="font-heading text-4xl font-bold uppercase tracking-wide text-white md:text-5xl">
          {titulo}
        </h1>
        <p className="hidden font-heading text-xs uppercase tracking-wider text-white/40 md:block">
          ({productos.length} productos)
        </p>
      </div>

      <div className="relative mb-4">
        <input
          ref={searchRef}
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por prenda, modelo o accesorio..."
          className="h-11 w-full rounded-md border border-white/10 bg-[#1D1B19] px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#E2781E]/50"
        />
      </div>

      <div className="sn-hide-scrollbar mb-8 flex gap-2 overflow-x-auto pb-1">
        {categorias.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoria(cat)}
            className={`shrink-0 rounded-md px-3 py-2 font-heading text-[11px] font-bold uppercase tracking-[0.12em] ${
              categoriaSeleccionada === cat
                ? "bg-[#E2781E] text-black"
                : "border border-white/10 bg-[#1D1B19] text-white/70"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex h-64 flex-col items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-[#E2781E]" />
          <p className="mt-3 text-sm text-white/50">Cargando catálogo…</p>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-white/10 bg-[#1D1B19] p-8 text-center">
          <p className="mb-4 text-sm text-[#E68C24]">{error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-md bg-[#E2781E] px-5 py-2 font-heading text-sm font-bold uppercase text-black"
            >
              Reintentar
            </button>
          )}
        </div>
      ) : productos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/15 bg-[#1D1B19] py-16 text-center">
          <p className="text-white/50">No encontramos productos en “{categoriaSeleccionada}”.</p>
          <button
            type="button"
            onClick={() => {
              setCategoria("Todos");
              setBusqueda("");
            }}
            className="mt-4 rounded-md bg-[#E2781E] px-5 py-2 font-heading text-sm font-bold uppercase text-black"
          >
            Ver todo el equipamiento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {productos.map((producto) => {
            const q = carritoQty(producto.id);
            const noPuede = productoSinStock(producto) || !puedeAgregarUnidad(producto, q);
            const fav = favoritos.includes(producto.id);
            return (
              <article key={producto.id} className="flex flex-col overflow-hidden rounded-lg border border-white/8 bg-[#1D1B19]">
                <div
                  role="button"
                  tabIndex={0}
                  className="relative aspect-[4/5] cursor-zoom-in bg-[#151311]"
                  onClick={() => producto.image && onAmpliar(producto.image, producto.name)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      producto.image && onAmpliar(producto.image, producto.name);
                    }
                  }}
                >
                  {producto.image ? (
                    <Image
                      src={producto.image}
                      alt={producto.name}
                      fill
                      className="object-cover"
                      sizes="(max-width:768px) 100vw, 25vw"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-white/20">Sin foto</div>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorito(producto.id);
                    }}
                    className={`absolute right-3 top-3 rounded-md p-1.5 ${fav ? "text-[#E2781E]" : "bg-black/40 text-white"}`}
                    aria-label="Favorito"
                  >
                    <IconHeart className="h-5 w-5" filled={fav} />
                  </button>
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className="font-heading text-lg font-bold uppercase leading-tight text-white">{producto.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-white/50">{producto.description || "Equipamiento técnico"}</p>
                  <p className="mt-3 font-heading text-2xl font-bold text-[#E2781E]">
                    ${formatARS(producto.price ?? 0)}
                  </p>
                  <p className="text-[11px] text-[#E68C24]">
                    ${formatARS(Math.round((producto.price ?? 0) * 0.9))} C/TRANSFERENCIA (−10%)
                  </p>
                  <button
                    type="button"
                    disabled={noPuede}
                    onClick={() => onAdd(producto)}
                    className={`mt-auto flex w-full items-center justify-center gap-2 rounded-md py-2.5 font-heading text-sm font-bold uppercase tracking-wide ${
                      noPuede
                        ? "cursor-not-allowed bg-white/10 text-white/40"
                        : "bg-[#E2781E] text-black hover:bg-[#C96614]"
                    }`}
                  >
                    {productoSinStock(producto) ? "Sin stock" : "Agregar al carrito"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
