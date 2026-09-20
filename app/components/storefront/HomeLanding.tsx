"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  CATEGORIAS_CAMPANA,
  PINES_BITACORA,
  PRODUCTOS_CAMPANA,
  TABS_DESTACADOS,
  formatARS,
  productoCampanaComoProduct,
  type ProductoCampana,
  type TabDestacados,
} from "../../lib/brand";
import type { Product } from "../../types";
import { IconAltitude, IconCompass, IconCreditCard, IconGuide, IconHeart, IconHiker, IconPlay, IconShield, IconTruck, IconWhatsApp, IconWind } from "./Icons";

type Props = {
  onCatalogo: (categoriaHint?: string) => void;
  onWhatsApp: () => void;
  onAdd: (producto: Product) => void;
  favoritos: string[];
  onToggleFavorito: (id: string) => void;
};

const BENEFICIOS = [
  {
    Icon: IconWind,
    title: "TESTEADO EN ALTURA",
    text: "Probado en ráfagas de 80km/h y roca abrasiva serrana.",
  },
  {
    Icon: IconTruck,
    title: "ENVÍO EXPRESS FEDERAL",
    text: "Despacho garantizado en 24hs a todo el territorio nacional.",
  },
  {
    Icon: IconCreditCard,
    title: "CUOTAS & 10% OFF",
    text: "Hasta 6 cuotas s/interés o 10% de ahorro directo vía transferencia.",
  },
  {
    Icon: IconGuide,
    title: "GUÍAS DE MONTAÑA",
    text: "Atención en vivo por montañistas activos vía WhatsApp.",
  },
];

const STATS = [
  { value: "2.884 MSNM", label: "Lab Cerro Champaquí", Icon: IconAltitude },
  { value: "MEMBRANAS 3L", label: "Impermeabilidad 28K MM", Icon: IconShield },
  { value: "+12.000 KMS", label: "Testeo en cordada real", Icon: IconHiker },
  { value: "GUÍAS AAGM", label: "Homologado en terreno", Icon: IconCompass },
];

function StarRow({ rating, reviews }: { rating: number; reviews: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-white/70">
      <span className="text-[#E2781E]">★</span>
      {rating.toFixed(1)} <span className="text-white/40">({reviews})</span>
    </span>
  );
}

function ProductoCard({
  producto,
  onAdd,
  favorito,
  onToggleFavorito,
}: {
  producto: ProductoCampana;
  onAdd: (producto: Product) => void;
  favorito: boolean;
  onToggleFavorito: (id: string) => void;
}) {
  const [talle, setTalle] = useState(producto.defaultSize ?? producto.sizes?.[0] ?? "");

  return (
    <article className="flex h-full min-w-[260px] flex-col overflow-hidden rounded-lg border border-white/8 bg-[#151311] sn-snap-item md:min-w-0">
      <div className="relative aspect-[4/5] bg-[#151311]">
        <Image src={producto.image} alt={producto.name} fill className="object-cover" sizes="(max-width:768px) 80vw, 25vw" />
        <div className="absolute left-3 top-3 flex flex-col gap-1">
          <span className="w-fit rounded bg-[#E2781E] px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-black">
            {producto.badge}
          </span>
          <span className="w-fit rounded bg-black/70 px-2 py-0.5 font-heading text-[10px] font-semibold uppercase tracking-wider text-white/90">
            {producto.badgeSub}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onToggleFavorito(producto.id)}
          className={`absolute right-3 top-3 rounded-md p-1.5 ${favorito ? "text-[#E2781E]" : "bg-black/40 text-white"}`}
          aria-label={favorito ? "Quitar de favoritos" : "Agregar a favoritos"}
        >
          <IconHeart className="h-5 w-5" filled={favorito} />
        </button>
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between text-[11px] text-white">
          <StarRow rating={producto.rating} reviews={producto.reviews} />
          <span className="font-heading uppercase tracking-wider text-white/80">
            {producto.metaLabel}: {producto.metaValue}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.14em] text-white/45">
          {producto.specLine}
        </p>
        <h3 className="mt-1 font-heading text-lg font-bold uppercase leading-tight tracking-wide text-white">
          {producto.name}
        </h3>
        <p className="mt-3 font-heading text-2xl font-bold text-[#E2781E]">
          ${formatARS(producto.price)}
          {producto.priceList && (
            <span className="ml-2 text-sm font-medium text-white/35 line-through">
              ${formatARS(producto.priceList)}
            </span>
          )}
        </p>
        <p className="mt-1 text-[11px] text-white/55">
          {producto.cuotas.n} cuotas s/interés de ${formatARS(producto.cuotas.monto)}
        </p>
        <p className="text-[11px] font-medium text-[#E68C24]">
          ${formatARS(producto.transferPrice)} C/TRANSFERENCIA (−10%)
        </p>
        <div className="mt-auto pt-4">
          {producto.sizes ? (
            <div>
              <p className="mb-1.5 font-heading text-[10px] uppercase tracking-wider text-white/40">Talles:</p>
              <div className="flex flex-wrap gap-1.5">
                {producto.sizes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTalle(s)}
                    className={`min-w-9 rounded-md px-2 py-1 font-heading text-xs font-bold ${
                      talle === s
                        ? "bg-[#E2781E] text-black"
                        : "border border-white/10 bg-white/5 text-white/80"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="font-heading text-[10px] uppercase tracking-wider text-white/50">
              Color: <span className="text-white">{producto.color}</span>
            </p>
          )}
          <button
            type="button"
            onClick={() => onAdd(productoCampanaComoProduct(producto))}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-[#E2781E] py-2.5 font-heading text-sm font-bold uppercase tracking-[0.12em] text-black hover:bg-[#C96614]"
          >
            <span aria-hidden>🛒</span> Agregar al carrito
          </button>
        </div>
      </div>
    </article>
  );
}

export function HomeLanding({
  onCatalogo,
  onWhatsApp,
  onAdd,
  favoritos,
  onToggleFavorito,
}: Props) {
  const [tab, setTab] = useState<TabDestacados>("todos");
  const [pinActivo, setPinActivo] = useState<number | null>(null);
  const destacados = useMemo(
    () => (tab === "todos" ? PRODUCTOS_CAMPANA : PRODUCTOS_CAMPANA.filter((p) => p.tab === tab)),
    [tab]
  );

  return (
    <>
      <section className="relative min-h-[78vh] overflow-hidden md:min-h-[86vh]">
        <Image
          src="/brand/hero-andes.png"
          alt="Cordillera andina al atardecer"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#151311] via-[#151311]/78 to-[#151311]/25" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#151311] via-transparent to-[#151311]/30" />
        <div className="relative mx-auto flex min-h-[78vh] max-w-7xl flex-col justify-center px-4 pb-32 pt-10 md:min-h-[86vh] md:pb-36 md:pt-16">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-md border border-[#E2781E]/50 bg-black/40 px-2.5 py-1 font-heading text-[10px] font-bold uppercase tracking-[0.16em] text-[#E68C24]">
              Temporada 2026 · Testeado en cumbre
            </span>
            <span className="rounded-md border border-white/15 bg-black/30 px-2.5 py-1 font-heading text-[10px] font-bold uppercase tracking-[0.16em] text-white/80">
              Sierras & Cordillera
            </span>
          </div>
          <h1 className="mt-5 max-w-4xl font-heading text-4xl font-bold uppercase leading-[0.95] tracking-wide text-white sm:text-5xl md:text-7xl">
            Expertos en el terreno,
            <span className="mt-1 block text-[#E68C24]">nómades por instinto</span>
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-relaxed text-[#D1D5DB] md:text-base">
            Ropa técnica, capas térmicas e indumentaria forjada para resistir la abrasión del
            granito en Los Gigantes y el viento blanco de la cordillera andina. Confección noble,
            sin concesiones.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onCatalogo()}
              className="inline-flex items-center gap-2 rounded-md bg-[#E2781E] px-5 py-3 font-heading text-sm font-bold uppercase tracking-[0.12em] text-black hover:bg-[#C96614]"
            >
              ◎ Explorar catálogo
            </button>
            <button
              type="button"
              onClick={() =>
                document.getElementById("bitacora")?.scrollIntoView({ behavior: "smooth" })
              }
              className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-black/40 px-5 py-3 font-heading text-sm font-bold uppercase tracking-[0.12em] text-white hover:bg-black/60"
            >
              <IconPlay /> Ver test en altura
            </button>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 px-4 pb-5 md:px-8 md:pb-6">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-y-4 rounded-xl border border-white/10 bg-[#1F1C19] px-5 py-4 md:grid-cols-4 md:gap-y-0 md:px-8 md:py-5">
            {STATS.map((s) => (
              <div key={s.value} className="flex items-center gap-3.5">
                <s.Icon className="h-6 w-6 shrink-0 text-[#E8A882]" />
                <div>
                  <p className="font-heading text-sm font-bold uppercase tracking-[0.08em] text-[#E8A882]">{s.value}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-white/40">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full bg-[#1D1B19]">
        <div className="px-4 py-8 md:px-8 md:py-10">
          <div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFICIOS.map((b) => (
              <div
                key={b.title}
                className="flex items-center gap-3.5 rounded-lg border border-[#3A342E] bg-[#151311] px-4 py-4 hover:border-[#E8A882]/35"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#3D2815] text-[#E8A882]">
                  <b.Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-heading text-[13px] font-bold uppercase tracking-[0.08em] text-white">{b.title}</h3>
                  <p className="mt-1 text-[12px] leading-snug text-white/50">{b.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="w-full bg-[#151311]">
        <div className="px-4 pb-6 pt-6 md:px-8 md:pb-10 md:pt-8">
          <div className="mx-auto max-w-7xl">
            <h2 className="mb-5 font-heading text-3xl font-bold uppercase tracking-wide text-white md:text-4xl">
              Equipamiento
            </h2>
            <div className="sn-hide-scrollbar sn-snap-row flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:overflow-visible">
              {CATEGORIAS_CAMPANA.map((cat) => (
                <article
                  key={cat.id}
                  className="relative h-[420px] w-[78vw] shrink-0 overflow-hidden rounded-lg border border-white/8 sn-snap-item md:h-[460px] md:w-auto"
                >
                  <Image src={cat.image} alt={cat.title} fill className="object-cover" sizes="(max-width:768px) 78vw, 25vw" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <p className="font-heading text-[10px] font-bold uppercase tracking-[0.16em] text-[#E68C24]">
                      {cat.kicker}
                    </p>
                    <h3 className="mt-1 font-heading text-xl font-bold uppercase leading-tight text-white">
                      {cat.title}
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-white/75">{cat.detail}</p>
                    <button
                      type="button"
                      onClick={() => onCatalogo(cat.catalogHint)}
                      className="mt-4 font-heading text-xs font-bold uppercase tracking-[0.14em] text-[#E2781E] hover:text-[#E68C24]"
                    >
                      Ver colección →
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="w-full bg-[#1D1B19]">
        <div className="px-4 py-10 md:px-8 md:py-14">
          <div className="mx-auto max-w-7xl">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <h2 className="font-heading text-2xl font-bold uppercase tracking-wide text-white md:text-4xl">
                Equipamiento destacado de campaña
              </h2>
              <div className="sn-hide-scrollbar flex gap-2 overflow-x-auto">
                {TABS_DESTACADOS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`shrink-0 rounded-md px-3 py-2 font-heading text-[11px] font-bold uppercase tracking-[0.12em] ${
                      tab === t.id
                        ? "bg-[#E2781E] text-black"
                        : "border border-white/10 bg-[#151311] text-white/70 hover:text-white"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="sn-hide-scrollbar sn-snap-row flex gap-4 overflow-x-auto pb-2 md:grid md:grid-cols-4 md:overflow-visible">
              {destacados.map((p) => (
                <ProductoCard
                  key={p.id}
                  producto={p}
                  onAdd={onAdd}
                  favorito={favoritos.includes(p.id)}
                  onToggleFavorito={onToggleFavorito}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="bitacora" className="mx-auto max-w-7xl px-4 py-10 md:py-16">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-lg border border-white/8">
            <div className="relative aspect-[4/3]">
              <Image
                src="/brand/bitacora-anorak.png"
                alt="Campera técnica de prototipo sobre roca"
                fill
                className="object-cover"
                sizes="(max-width:768px) 100vw, 50vw"
              />
              {PINES_BITACORA.map((pin) => (
                <button
                  key={pin.n}
                  type="button"
                  onMouseEnter={() => setPinActivo(pin.n)}
                  onMouseLeave={() => setPinActivo(null)}
                  onClick={() => setPinActivo(pinActivo === pin.n ? null : pin.n)}
                  className="absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#E68C24] font-heading text-xs font-bold text-black ring-4 ring-black/30"
                  style={{ left: pin.x, top: pin.y }}
                  aria-label={pin.label}
                >
                  {pin.n}
                  {pinActivo === pin.n && (
                    <span className="absolute left-8 top-1/2 z-10 w-44 -translate-y-1/2 rounded-md border border-white/10 bg-[#1D1B19] px-2 py-1.5 text-left text-[11px] font-sans font-medium normal-case tracking-normal text-[#D1D5DB] shadow-xl">
                      {pin.label}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="flex justify-between bg-black/70 px-4 py-2 font-heading text-[10px] uppercase tracking-[0.14em] text-white/70">
              <span>Córdoba Lab · Serie prototipo C-04</span>
              <span>Pasá el cursor sobre los pines</span>
            </div>
          </div>
          <div>
            <span className="inline-flex items-center gap-2 rounded-md border border-white/10 bg-[#1D1B19] px-3 py-1.5 font-heading text-[10px] font-bold uppercase tracking-[0.16em] text-[#E68C24]">
              ⚑ Bitácora de guía AAGM
            </span>
            <blockquote className="mt-5 font-heading text-3xl font-bold uppercase leading-tight tracking-wide text-white md:text-4xl">
              “En el filo de Los Gigantes, el equipo es tu primera línea de vida.”
            </blockquote>
            <p className="mt-5 border-l-2 border-[#E2781E] pl-4 text-sm leading-relaxed text-[#D1D5DB]">
              Probamos el tejido ripstop en 14 vivacs consecutivos sobre la canaleta oeste del Cerro
              Champaquí. Vientos de 85 km/h a −6°C. El termosellado retuvo el calor corporal sin
              condensación interna perceptible.
            </p>
            <div className="mt-6 flex items-center gap-3 rounded-lg border border-white/8 bg-[#1D1B19] p-3">
              <Image
                src="/brand/guia-martin.png"
                alt="Martín Ferrero"
                width={56}
                height={56}
                className="h-14 w-14 rounded-md object-cover"
              />
              <div>
                <p className="font-heading text-sm font-bold uppercase tracking-wide text-white">
                  Martín Ferrero
                </p>
                <p className="text-[11px] uppercase tracking-wider text-white/50">
                  Guía de alta montaña AAGM · Refugio Los Espinillos
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="nosotros" className="w-full bg-[#1D1B19]">
        <div className="px-4 py-10 md:px-8 md:py-16">
          <div className="mx-auto max-w-7xl">
            <p className="flex items-center gap-2 font-heading text-[11px] font-bold uppercase tracking-[0.18em] text-[#E2781E]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#E2781E]" /> Nuestra esencia
            </p>
            <h2 className="mt-4 max-w-4xl font-heading text-3xl font-bold uppercase leading-tight tracking-wide text-white md:text-5xl">
              Nacidos en Córdoba, Argentina.
              <span className="mt-1 block text-[#E68C24]">Construidos para cualquier horizonte.</span>
            </h2>
            <p className="mt-5 max-w-3xl text-sm leading-relaxed text-[#D1D5DB] md:text-base">
              Combinamos la precisión técnica con la pasión auténtica de quienes viven bajo las
              estrellas. Seleccionamos cada calzado y accesorio con el rigor de quien prueba cada
              costura en el terreno, para ofrecerte equipo de alta resistencia que asegure que nada te
              detenga en la ruta.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { n: "+12.000", l: "Kms de senda transitados" },
                { n: "100%", l: "Confección nacional testeada" },
                { n: "0%", l: "Relleno térmico no probado" },
              ].map((m) => (
                <div key={m.l} className="rounded-lg border border-white/8 bg-[#151311] px-5 py-4">
                  <p className="font-heading text-3xl font-bold text-[#E68C24]">{m.n}</p>
                  <p className="mt-1 font-heading text-[11px] uppercase tracking-[0.14em] text-white/50">{m.l}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 flex flex-col items-start justify-between gap-6 rounded-lg border border-white/8 bg-[#151311] p-6 md:flex-row md:items-center md:p-8">
              <div>
                <span className="inline-flex items-center gap-2 rounded-md bg-black/40 px-2.5 py-1 font-heading text-[10px] font-bold uppercase tracking-[0.14em] text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#25d366]" /> Guía en línea ahora mismo
                </span>
                <h2 className="mt-3 font-heading text-2xl font-bold uppercase tracking-wide text-white md:text-3xl">
                  ¿Preparando una cumbre o expedición?
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#D1D5DB]">
                  Escribinos directamente para consultar compatibilidad de talles, peso de mochila
                  recomendado o el sistema de tres capas ideal según tu destino y pronóstico.
                </p>
              </div>
              <button
                type="button"
                onClick={onWhatsApp}
                className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[#25d366] px-5 py-3 font-heading text-sm font-bold uppercase tracking-[0.1em] text-[#052e16] hover:bg-[#1ebe5d]"
              >
                <IconWhatsApp className="h-5 w-5" /> Hablar con un guía por WhatsApp
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
