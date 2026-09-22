"use client";

import { useMemo, useState } from "react";
import type { Pedido, Product } from "../../types";
import { formatARS } from "../../lib/brand";
import {
  calcularResumenOperativo,
  type PeriodoResumen,
} from "../../lib/admin-resumen";

type Props = {
  pedidos: Pedido[];
  productos: Product[];
  actualizando: boolean;
  onActualizar: () => void;
  onVerPedidos: () => void;
  onVerProductos: () => void;
  onIngresarStock: (product: Product) => void;
};

function horaHs(d: Date): string {
  return d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function fmtDelta(pct: number | null): string | null {
  if (pct === null || !Number.isFinite(pct)) return null;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(1)}%`;
}

const pillClass = (activo: boolean) =>
  `px-3 py-1.5 rounded-lg font-heading text-[10px] font-bold uppercase tracking-wide transition ${
    activo ? "bg-[#E2781E] text-white shadow" : "text-[#9CA3AF] hover:text-white"
  }`;

function KpiBar({ pct, color = "bg-[#E2781E]" }: { pct: number; color?: string }) {
  const w = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${w}%` }} />
    </div>
  );
}

export function ResumenTienda({
  pedidos,
  productos,
  actualizando,
  onActualizar,
  onVerPedidos,
  onVerProductos,
  onIngresarStock,
}: Props) {
  const [periodo, setPeriodo] = useState<PeriodoResumen>("mes");
  const [hora, setHora] = useState(() => horaHs(new Date()));
  const r = useMemo(
    () => calcularResumenOperativo(pedidos, productos, periodo),
    [pedidos, productos, periodo]
  );
  const delta = fmtDelta(r.deltaPct);
  const deltaTicket = fmtDelta(r.deltaTicketPct);
  const maxHist = Math.max(r.ventana30.monto, r.ventana7.monto, 1);
  const ancho7 = Math.max(2, Math.round((r.ventana7.monto / maxHist) * 100));
  const ancho30 = Math.max(2, Math.round((r.ventana30.monto / maxHist) * 100));
  const barraFact =
    r.pedidosRegistrados > 0 ? (r.pedidosConfirmados / r.pedidosRegistrados) * 100 : 0;
  const barraTicket = Math.min(100, r.unidadesPorCanasta * 25);
  const barraLog =
    r.logisticaPendientes > 0
      ? (r.logisticaTaller / r.logisticaPendientes) * 100 || 8
      : 0;
  const barraStock =
    r.itemsTienda > 0 ? ((r.itemsTienda - r.agotados) / r.itemsTienda) * 100 : 0;

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#1D1B19] p-5 shadow-xl sm:p-6 md:flex-row md:items-center">
        <div>
          <p className="mb-1 flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#E2781E] sm:text-xs">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#E2781E]" />
            Centro de operaciones // tienda en vivo
          </p>
          <h2 className="font-heading text-2xl font-black uppercase tracking-wide text-white sm:text-3xl">
            Resumen general y rendimiento
          </h2>
          <p className="mt-1 max-w-2xl text-xs text-[#9CA3AF] sm:text-sm">
            Métricas del catálogo activo y de los pedidos web. El rango de fechas aplica a
            facturación, ticket y embudo; el stock y la logística abierta son del momento.
          </p>
        </div>
        <div className="flex shrink-0 flex-nowrap items-center gap-3">
          <div className="flex items-center rounded-xl border border-white/10 bg-[#151311] p-1">
            <button type="button" className={pillClass(periodo === "hoy")} onClick={() => setPeriodo("hoy")}>
              Hoy
            </button>
            <button type="button" className={pillClass(periodo === "7dias")} onClick={() => setPeriodo("7dias")}>
              7 días
            </button>
            <button type="button" className={pillClass(periodo === "mes")} onClick={() => setPeriodo("mes")}>
              Este mes ({r.etiquetaMes})
            </button>
            <button
              type="button"
              className={pillClass(periodo === "historico")}
              onClick={() => setPeriodo("historico")}
            >
              Histórico
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              setHora(horaHs(new Date()));
              onActualizar();
            }}
            disabled={actualizando}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 font-heading text-[10px] font-bold uppercase tracking-wide text-[#D1D5DB] hover:bg-white/10 hover:text-white disabled:opacity-50"
          >
            <span className={actualizando ? "inline-block animate-spin" : ""}>⟳</span>
            {actualizando ? "Sincronizando…" : "Actualizar datos"}
            <span className="hidden font-mono text-[10px] text-[#6B7280] sm:inline">{hora} hs</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="flex min-h-[10.5rem] flex-col rounded-2xl border border-white/[0.08] bg-[#1D1B19] p-5">
          <div className="mb-2 flex items-start justify-between gap-2">
            <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
              Facturación acumulada
            </span>
            {delta ? (
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                  (r.deltaPct ?? 0) >= 0
                    ? "border-emerald-500/20 bg-emerald-950/40 text-emerald-400"
                    : "border-red-500/20 bg-red-950/40 text-red-400"
                }`}
              >
                ↗ {delta}
              </span>
            ) : (
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-[#6B7280]">
                Sin comparación
              </span>
            )}
          </div>
          <p className="font-heading text-3xl font-black tracking-tight text-white">
            ${formatARS(r.facturacion)}{" "}
            <span className="text-sm font-semibold text-[#9CA3AF]">ARS</span>
          </p>
          <div className="mt-auto pt-3">
            <div className="flex justify-between text-xs text-[#9CA3AF]">
              <span>{r.pedidosRegistrados} pedidos registrados</span>
              <span className="font-bold text-emerald-400">{r.pedidosConfirmados} confirmados</span>
            </div>
            <KpiBar pct={barraFact} />
          </div>
        </article>

        <article className="flex min-h-[10.5rem] flex-col rounded-2xl border border-white/[0.08] bg-[#1D1B19] p-5">
          <div className="mb-2 flex items-start justify-between gap-2">
            <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
              Ticket promedio
            </span>
            {deltaTicket ? (
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${
                  (r.deltaTicketPct ?? 0) >= 0
                    ? "border-emerald-500/20 bg-emerald-950/40 text-emerald-400"
                    : "border-red-500/20 bg-red-950/40 text-red-400"
                }`}
              >
                ↗ {deltaTicket}
              </span>
            ) : (
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-[#6B7280]">
                —
              </span>
            )}
          </div>
          <p className="font-heading text-3xl font-black tracking-tight text-white">
            ${formatARS(Math.round(r.ticketPromedio))}{" "}
            <span className="text-xs font-semibold uppercase text-[#9CA3AF]">ARS / orden</span>
          </p>
          <div className="mt-auto pt-3">
            <div className="flex justify-between text-xs text-[#9CA3AF]">
              <span>Densidad por canasta</span>
              <span className="font-bold text-[#E2781E]">{r.unidadesPorCanasta.toFixed(1)} unidades</span>
            </div>
            <KpiBar pct={barraTicket} />
          </div>
        </article>

        <article className="flex min-h-[10.5rem] flex-col rounded-2xl border border-white/[0.08] bg-[#1D1B19] p-5">
          <div className="mb-2 flex items-start justify-between gap-2">
            <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
              Logística activa
            </span>
            <span className="inline-flex items-center gap-1 rounded-md border border-[#E2781E]/20 bg-[#E2781E]/10 px-2 py-0.5 text-[10px] font-bold uppercase text-[#E2781E]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E2781E]" />
              Flujo vivo
            </span>
          </div>
          <p className="font-heading text-3xl font-black tracking-tight text-white">
            {r.logisticaPendientes}{" "}
            <span className="text-sm font-semibold uppercase text-[#9CA3AF]">Pendientes</span>
          </p>
          <div className="mt-auto pt-3">
            <div className="flex justify-between text-xs text-[#9CA3AF]">
              <span>
                {r.logisticaRecibidos} recibidos · {r.logisticaTaller} en taller
              </span>
              <span className="font-bold text-[#E8A882]">{r.pendientesConfirmar} p/ confirmar</span>
            </div>
            <KpiBar pct={barraLog} />
          </div>
        </article>

        <article
          className={`flex min-h-[10.5rem] flex-col rounded-2xl border p-5 ${
            r.alertasStock > 0
              ? "border-red-500/30 bg-gradient-to-br from-red-950/10 to-[#1D1B19]"
              : "border-white/[0.08] bg-[#1D1B19]"
          }`}
        >
          <div className="mb-2 flex items-start justify-between gap-2">
            <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
              Salud de stock
            </span>
            {r.alertasStock > 0 ? (
              <span className="rounded-md border border-red-500/30 bg-red-950/60 px-2 py-0.5 text-[10px] font-bold uppercase text-red-400">
                * {r.alertasStock} crítico{r.alertasStock === 1 ? "" : "s"}
              </span>
            ) : (
              <span className="rounded-md border border-emerald-500/20 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-400">
                Sin alertas
              </span>
            )}
          </div>
          <p className="font-heading text-3xl font-black tracking-tight text-white">
            {r.stockCritico ? (
              <>
                {r.stockCritico.stock} u.{" "}
                <span className="text-xs font-bold uppercase tracking-wider text-red-400">
                  {r.stockCritico.name}
                </span>
              </>
            ) : (
              <span className="text-emerald-400">OK</span>
            )}
          </p>
          <div className="mt-auto pt-3">
            <div className="flex justify-between text-xs text-[#9CA3AF]">
              <span>{r.itemsTienda} ítems en tienda</span>
              <span className={r.alertasStock > 0 ? "font-bold text-red-400" : "font-bold text-emerald-400"}>
                {r.bajoStock} bajo · {r.agotados} agotado{r.agotados === 1 ? "" : "s"}
              </span>
            </div>
            <KpiBar pct={barraStock} />
          </div>
        </article>
      </div>

      <section className="rounded-2xl border border-white/[0.08] bg-[#1D1B19] p-5 shadow-xl sm:p-6">
        <div className="flex flex-col justify-between gap-2 border-b border-white/5 pb-4 sm:flex-row sm:items-center">
          <div>
            <h3 className="flex items-center gap-2 font-heading text-sm font-black uppercase tracking-wider text-white">
              <span className="text-[#E2781E]" aria-hidden>
                📈
              </span>
              Embudo de pedidos y estados logísticos
            </h3>
            <p className="mt-0.5 text-xs text-[#9CA3AF]">
              Lista del período: <strong className="text-white">{r.totalLista} pedidos</strong>. Total
              no cancelado:{" "}
              <strong className="text-[#E2781E]">${formatARS(r.montoNoCancelado)} ARS</strong> (
              {r.cantidadActivos} activos/completados).
            </p>
          </div>
          <span className="rounded-md border border-white/5 bg-white/5 px-2.5 py-1 font-mono text-[10px] uppercase text-[#9CA3AF]">
            Canal: WhatsApp · catálogo web
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
          {r.embudo.map((e) => {
            const badge =
              e.tono === "naranja"
                ? "bg-[#E2781E]/20 text-[#E2781E]"
                : e.tono === "verde"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : e.tono === "rojo"
                    ? "bg-red-500/20 text-red-400"
                    : "bg-white/10 text-[#9CA3AF]";
            const pie =
              e.tono === "naranja"
                ? "text-[#E2781E]"
                : e.tono === "verde"
                  ? "text-emerald-400"
                  : e.tono === "rojo"
                    ? "text-red-400"
                    : "text-[#6B7280]";
            const barraColor =
              e.tono === "verde"
                ? "bg-emerald-400"
                : e.tono === "rojo"
                  ? "bg-red-400"
                  : e.tono === "tenue"
                    ? "bg-white/35"
                    : "bg-[#E2781E]";
            const barraPct =
              e.key === "recibido"
                ? (r.tasaPasoPct ?? 0)
                : e.key === "cancelado"
                  ? (r.tasaDesercionPct ?? 0)
                  : r.totalLista > 0
                    ? (e.count / r.totalLista) * 100
                    : 0;
            return (
              <div
                key={e.key}
                className={`flex min-h-[11rem] flex-col justify-between rounded-xl border bg-[#151311] p-4 ${
                  e.tono === "rojo" ? "border-red-500/20" : "border-white/5"
                }`}
              >
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span
                      className={`font-heading text-[11px] font-bold uppercase tracking-wider ${
                        e.tono === "rojo" ? "text-red-400" : "text-[#D1D5DB]"
                      }`}
                    >
                      {e.titulo}
                    </span>
                    <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs font-bold ${badge}`}>
                      {e.count}
                    </span>
                  </div>
                  <p
                    className={`mb-1 font-heading text-xl font-bold ${
                      e.tono === "rojo" ? "text-red-300" : e.count === 0 ? "text-[#6B7280]" : "text-white"
                    }`}
                  >
                    ${formatARS(e.monto)}
                  </p>
                  <p className="text-[11px] text-[#9CA3AF]">{e.detalle}</p>
                </div>
                <div className="mt-4">
                  <div className={`flex items-center justify-between font-heading text-[10px] font-bold uppercase ${pie}`}>
                    <span>{e.pie}</span>
                    <span aria-hidden>{e.tono === "rojo" ? "✕" : e.tono === "tenue" ? "✓" : "→"}</span>
                  </div>
                  <KpiBar pct={barraPct} color={barraColor} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-col justify-between gap-2 rounded-xl border border-white/10 bg-[#151311] px-4 py-3 text-xs text-[#9CA3AF] sm:flex-row sm:items-center">
          <p className="inline-flex min-w-0 items-center gap-2.5">
            <svg className="h-4 w-4 shrink-0 text-[#E2781E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0"
              />
            </svg>
            <span>
              Modificación sin confirmar (cliente):{" "}
              <strong className="text-white">{r.modificacionPendienteCliente}</strong>
              {" · "}
              Cliente confirmó (pendiente de marcar visto):{" "}
              <strong className="text-white">{r.clienteConfirmoSinVista}</strong>
            </span>
          </p>
          <p className="inline-flex shrink-0 items-center gap-2 font-mono text-[11px] uppercase tracking-wide text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Pedidos web sincronizados
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <section className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#1D1B19] p-5 shadow-xl sm:p-6 lg:col-span-7">
          <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-3">
            <div>
              <h3 className="font-heading text-sm font-black uppercase tracking-wider text-white">
                Inventario crítico y control de stock
              </h3>
              <p className="mt-0.5 text-xs text-[#9CA3AF]">
                Los artículos en cero detienen el checkout de ese producto en la tienda.
              </p>
            </div>
            {r.alertasStock > 0 ? (
              <span className="shrink-0 rounded-md border border-red-500/30 bg-red-950/60 px-2.5 py-1 font-heading text-[10px] font-bold uppercase text-red-400">
                {r.alertasStock} alerta{r.alertasStock === 1 ? "" : "s"} activa
              </span>
            ) : (
              <span className="shrink-0 rounded-md border border-emerald-500/20 bg-emerald-950/40 px-2.5 py-1 font-heading text-[10px] font-bold uppercase text-emerald-400">
                Sin alertas
              </span>
            )}
          </div>

          <div className="space-y-3">
            {r.inventario.length === 0 ? (
              <p className="rounded-xl border border-white/5 bg-[#151311] px-3.5 py-4 text-xs text-[#9CA3AF]">
                Todavía no hay productos en el catálogo.
              </p>
            ) : (
              r.inventario.map((fila) => {
                if (fila.tipo === "sin_tope") {
                  return (
                    <div
                      key="sin-tope"
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-[#151311] p-3.5"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[#9CA3AF]">
                          ∞
                        </span>
                        <div className="min-w-0">
                          <p className="font-heading text-xs font-bold uppercase text-white">
                            Sin tope de inventario
                          </p>
                          <p className="mt-0.5 text-[11px] text-[#9CA3AF]">
                            {fila.count} artículo{fila.count === 1 ? "" : "s"} configurado
                            {fila.count === 1 ? "" : "s"} sin tope (venta continua a pedido).
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 rounded bg-white/10 px-2 py-0.5 font-heading text-[10px] font-bold uppercase text-[#D1D5DB]">
                        Sin tope web
                      </span>
                    </div>
                  );
                }
                const p = fila.product;
                const esAgotado = fila.tipo === "agotado";
                const esBajo = fila.tipo === "bajo";
                return (
                  <div
                    key={p.id}
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 ${
                      esAgotado ? "border-red-500/30 bg-[#151311]" : "border-white/5 bg-[#151311]"
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border font-heading text-sm font-bold ${
                          esAgotado
                            ? "border-red-500/30 bg-red-950/40 text-red-400"
                            : esBajo
                              ? "border-white/10 bg-white/5 text-[#E2781E]"
                              : "border-white/10 bg-white/5 text-[#9CA3AF]"
                        }`}
                      >
                        {p.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-heading text-xs font-bold uppercase text-white">{p.name}</h4>
                          <span
                            className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${
                              esAgotado
                                ? "bg-red-950 text-red-400"
                                : esBajo
                                  ? "bg-[#3D2815] text-[#E2781E]"
                                  : "bg-emerald-950/60 text-emerald-400"
                            }`}
                          >
                            {esAgotado ? "Agotado" : esBajo ? "Stock bajo" : "Estable"}
                          </span>
                        </div>
                        <p className="mt-0.5 font-mono text-[11px] text-[#9CA3AF]">
                          ID {p.id.slice(0, 8)} ·{" "}
                          <strong className={esAgotado ? "text-red-400" : esBajo ? "text-[#E2781E]" : "text-[#D1D5DB]"}>
                            Stock actual: {p.stock ?? 0} unidades
                          </strong>
                        </p>
                      </div>
                    </div>
                    {esAgotado ? (
                      <button
                        type="button"
                        onClick={() => onIngresarStock(p)}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#E2781E] px-3 py-1.5 font-heading text-xs font-bold uppercase text-black hover:bg-[#C96614]"
                      >
                        + Ingresar stock
                      </button>
                    ) : (
                      <span className="shrink-0 font-mono text-[11px] text-[#9CA3AF]">
                        {esBajo ? "Umbral crítico (1–5 u.)" : "Control regular"}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-3 text-center sm:grid-cols-4">
            {[
              { l: "Publicados", v: String(r.publicados), c: "text-white" },
              { l: "Unidades c/ tope", v: `${r.unidadesConTope} u.`, c: "text-white" },
              { l: "Stock controlado", v: `${r.stockControlado} prod.`, c: "text-[#E2781E]" },
              { l: "Sin tope web", v: `${r.sinTope} prod.`, c: "text-emerald-400" },
            ].map((x) => (
              <div key={x.l} className="rounded-lg bg-[#151311] p-2">
                <span className="block font-heading text-[10px] uppercase text-[#9CA3AF]">{x.l}</span>
                <strong className={`font-heading text-sm font-bold uppercase ${x.c}`}>{x.v}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="lg:col-span-5">
          <div className="space-y-5 rounded-2xl border border-white/[0.08] bg-[#1D1B19] p-5 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-2 border-b border-white/5 pb-3">
              <div>
                <h3 className="font-heading text-sm font-black uppercase tracking-wider text-white">
                  Historial comparativo
                </h3>
                <p className="mt-0.5 text-xs text-[#9CA3AF]">
                  Facturación y pedidos creados en ventanas móviles.
                </p>
              </div>
              <span className="font-mono text-[10px] uppercase text-[#9CA3AF]">Expedición</span>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="font-heading font-bold uppercase text-[#D1D5DB]">Últimos 7 días</span>
                <span className="text-[#9CA3AF]">Ciclo corto</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-heading text-2xl font-black text-white">
                  ${formatARS(r.ventana7.monto)}{" "}
                  <span className="text-xs font-normal text-[#9CA3AF]">ARS total</span>
                </span>
                <span className="text-xs text-[#9CA3AF]">{r.ventana7.cantidad} pedidos creados</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#151311]">
                <div className="h-full bg-[#E2781E]" style={{ width: `${ancho7}%` }} />
              </div>
            </div>

            <div className="space-y-1.5 pt-2">
              <div className="flex justify-between text-xs">
                <span className="font-heading font-bold uppercase text-[#D1D5DB]">
                  Últimos 30 días (corriente)
                </span>
                <span className="font-bold text-emerald-400">✓ Ventana principal</span>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-heading text-2xl font-black text-[#E2781E]">
                  ${formatARS(r.ventana30.monto)}{" "}
                  <span className="text-xs font-normal text-[#9CA3AF]">ARS total</span>
                </span>
                <span className="text-xs font-bold text-[#D1D5DB]">{r.ventana30.cantidad} pedidos creados</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#151311]">
                <div className="h-full bg-[#E2781E]" style={{ width: `${ancho30}%` }} />
              </div>
            </div>

            <div className="space-y-1 rounded-xl border border-[#E2781E]/20 bg-[#151311] p-4 text-xs text-[#D1D5DB]">
              <p className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#E2781E]">
                Consejo de inventario
              </p>
              <p className="leading-relaxed">{r.consejo}</p>
            </div>
          </div>
        </section>
      </div>

      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-white/[0.08] bg-[#1D1B19] p-4 sm:flex-row sm:items-center">
        <div>
          <h4 className="font-heading text-xs font-bold uppercase text-white">Atajos de gestión rápida</h4>
          <p className="text-[11px] text-[#9CA3AF]">Catálogo y despachos, sin salir del panel.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onVerPedidos}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 font-heading text-xs font-bold uppercase text-[#D1D5DB] hover:bg-white/10 hover:text-white"
          >
            Ver {r.logisticaPendientes} pedidos pendientes
          </button>
          <button
            type="button"
            onClick={onVerProductos}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E2781E] px-4 py-2 font-heading text-xs font-bold uppercase text-black hover:bg-[#C96614]"
          >
            Administrar productos
          </button>
        </div>
      </div>
    </div>
  );
}
