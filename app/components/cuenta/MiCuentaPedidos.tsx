"use client";

import { useState } from "react";
import type { User } from "firebase/auth";
import type { Pedido, PedidoEstado, Product } from "../../types";
import { formatARS } from "../../lib/brand";
import { pedidoTieneConfirmacionPendienteCliente } from "../../lib/pedidos";
import { urlWhatsAppTiendaConsultaGeneral, urlWhatsAppTiendaPedido } from "../../lib/whatsapp";
import { IconPhone, IconSearch, IconShield, IconWhatsApp } from "../storefront/Icons";
import { formatTelAR } from "../panels/panel-ui";
import { CuentaExpedicionStepper } from "./CuentaExpedicionStepper";
import { CuentaPedidoDetalle } from "./CuentaPedidoDetalle";

type Tab = "en_curso" | "historial" | "cancelados";

type Props = {
  user: User;
  pedidos: Pedido[];
  cargandoPedidos: boolean;
  productos: Product[];
  error: string | null;
  accionPedidoId: string | null;
  pedidosConfirmados: string[];
  onConfirmarPedido: (p: Pedido) => void;
  onClose: () => void;
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function textoFechaPedido(p: Pedido): string {
  if (pedidoTieneConfirmacionPendienteCliente(p) && p.updatedAt) {
    const minutos = Math.max(0, Math.round((Date.now() - p.updatedAt.getTime()) / 60_000));
    if (minutos < 1) return "Actualizado ahora";
    if (minutos < 60) return `Actualizado hace ${minutos} minuto${minutos === 1 ? "" : "s"}`;
    const horas = Math.round(minutos / 60);
    if (horas < 24) return `Actualizado hace ${horas} hora${horas === 1 ? "" : "s"}`;
  }
  if (!p.createdAt) return "Fecha no disponible";
  return p.createdAt.toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short" });
}

function rangoOperador(totalPedidos: number): string {
  if (totalPedidos >= 6) return "Escalón Andes T-3";
  if (totalPedidos >= 3) return "Escalón Andes T-2";
  if (totalPedidos >= 1) return "Escalón Andes T-1";
  return "Operador nuevo";
}

function copyEtapa(status: PedidoEstado): { kicker: string; detail: string; despacho: string } | null {
  if (status === "recibido") {
    return {
      kicker: "Etapa 1 en curso: pedido recibido",
      detail: "Tu orden está registrada. El taller de Córdoba la toma a continuación.",
      despacho: "Te avisamos por WhatsApp",
    };
  }
  if (status === "en_preparacion") {
    return {
      kicker: "Etapa 2 en curso: taller de costura y montaje",
      detail: "Armando paquete y control de costuras de refuerzo en taller Córdoba.",
      despacho: "Despacho previsto · te confirmamos por WhatsApp",
    };
  }
  return null;
}

function badgePedido(p: Pedido): { text: string; className: string } {
  if (pedidoTieneConfirmacionPendienteCliente(p)) {
    return {
      text: "Acción requerida // Ajuste de stock",
      className: "border-[#E2781E] bg-[#E2781E]/20 text-[#E8A882]",
    };
  }
  const map: Record<PedidoEstado, { text: string; className: string }> = {
    recibido: {
      text: "Pedido recibido",
      className: "border-white/10 bg-white/5 text-[#D1D5DB]",
    },
    en_preparacion: {
      text: "En preparación",
      className: "border-white/10 bg-white/5 text-[#D1D5DB]",
    },
    enviado: {
      text: "Enviado // En ruta",
      className: "border-[#E2781E]/40 bg-[#3D2815] text-[#E8A882]",
    },
    entregado: {
      text: "Entregado",
      className: "border-emerald-500/30 bg-emerald-950/40 text-emerald-400",
    },
    cancelado: {
      text: "Cancelado",
      className: "border-red-500/30 bg-red-950/40 text-red-400",
    },
  };
  return map[p.status];
}

export function MiCuentaPedidos({
  user,
  pedidos,
  cargandoPedidos,
  productos,
  error,
  accionPedidoId,
  pedidosConfirmados,
  onConfirmarPedido,
  onClose,
}: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [tabPedidos, setTabPedidos] = useState<Tab>("en_curso");

  const nActivos = pedidos.filter((p) => p.status !== "cancelado" && p.status !== "entregado").length;
  const nEntregados = pedidos.filter((p) => p.status === "entregado").length;
  const nCancelados = pedidos.filter((p) => p.status === "cancelado").length;
  const montoAcumulado = pedidos
    .filter((p) => p.status !== "cancelado")
    .reduce((s, p) => s + (p.total || 0), 0);
  const telefono = pedidos.find((p) => p.clientPhone)?.clientPhone;
  const q = busqueda.trim().toLowerCase();

  const pedidosFiltrados = pedidos.filter((p) => {
    if (tabPedidos === "en_curso" && (p.status === "entregado" || p.status === "cancelado")) return false;
    if (tabPedidos === "historial" && p.status !== "entregado") return false;
    if (tabPedidos === "cancelados" && p.status !== "cancelado") return false;
    if (!q) return true;
    return (
      p.id.toLowerCase().includes(q) ||
      p.items.some((it) => it.name.toLowerCase().includes(q)) ||
      (p.guiaTracking?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-3 font-heading text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
        <div className="flex flex-wrap items-center gap-2">
          <span>Base operativa</span>
          <span className="text-white/30">›</span>
          <span>Terminal cliente</span>
          <span className="text-white/30">›</span>
          <span className="text-[#E2781E]">Registro de expedición</span>
        </div>
        <div className="inline-flex items-center gap-1.5 text-[10px] text-[#E2781E]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#E2781E]" />
          Telemetría en vivo · Córdoba v2.4
        </div>
      </div>

      <section className="grid grid-cols-1 items-stretch gap-6 rounded-2xl border border-white/[0.08] bg-[#1D1B19] p-6 shadow-xl lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-start gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#E2781E]/30 bg-[#E2781E]/10 text-[#E2781E]">
              <IconShield className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  id="cuenta-cliente-title"
                  className="max-w-full truncate font-heading text-xl font-black uppercase tracking-wide text-white"
                >
                  {user.email}
                </h1>
                <span className="rounded-md border border-[#E2781E]/30 bg-[#3D2815] px-2 py-0.5 font-heading text-[10px] font-bold uppercase tracking-wider text-[#E8A882]">
                  ● Cliente verificado // Andes club
                </span>
              </div>
              <p className="mt-1 font-heading text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                Rango de operador:{" "}
                <span className="text-[#E8A882]">{rangoOperador(pedidos.length)}</span>
              </p>
              {telefono && (
                <p className="mt-0.5 flex items-center gap-1.5 font-heading text-xs uppercase tracking-wide text-[#9CA3AF]">
                  <IconPhone className="h-3.5 w-3.5 text-[#E2781E]" />
                  {formatTelAR(telefono)}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-between gap-3 rounded-xl border border-white/5 bg-[#151311] p-3.5 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-start gap-2 text-xs text-[#D1D5DB]">
              <span className="shrink-0 text-[#E2781E]" aria-hidden>
                📍
              </span>
              <div>
                <span className="block font-heading text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                  Dirección principal · depósito domiciliario
                </span>
                <p className="mt-0.5 leading-snug text-[#D1D5DB]">
                  La dirección de entrega la coordinamos contigo por WhatsApp al confirmar cada pedido.
                </p>
              </div>
            </div>
            <a
              href={urlWhatsAppTiendaConsultaGeneral()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 font-heading text-[10px] font-bold uppercase tracking-wide text-[#D1D5DB] hover:bg-white/10 hover:text-white"
            >
              ⇄ Gestionar destinos
            </a>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-white/10 pt-4 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div className="rounded-xl border border-white/5 bg-[#151311] p-3 text-center">
            <span className="block font-heading text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
              Pedidos totales
            </span>
            <strong className="mt-1 block font-heading text-2xl font-black text-white">{pad2(pedidos.length)}</strong>
            <span className="block font-heading text-[9px] uppercase tracking-wider text-[#6B7280]">Registrados</span>
          </div>
          <div className="rounded-xl border border-[#E2781E]/30 bg-[#151311] p-3 text-center">
            <span className="block font-heading text-[10px] font-bold uppercase tracking-wider text-[#E2781E]">
              Activos en curso
            </span>
            <strong className="mt-1 block font-heading text-2xl font-black text-[#E2781E]">{pad2(nActivos)}</strong>
            <span className="block font-heading text-[9px] uppercase tracking-wider text-[#E8A882]">En línea</span>
          </div>
          <div className="rounded-xl border border-white/5 bg-[#151311] p-3 text-center">
            <span className="block font-heading text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
              Equipamiento
            </span>
            <strong className="mt-1 block font-heading text-lg font-black leading-tight text-white">
              ${formatARS(montoAcumulado)}
            </strong>
            <span className="block font-heading text-[9px] uppercase tracking-wider text-[#6B7280]">ARS</span>
          </div>
        </div>
      </section>

      {error && (
        <p className="rounded-xl bg-red-950/50 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-white/10 bg-[#1D1B19] p-1 font-heading text-xs font-bold uppercase tracking-wide">
          {(
            [
              ["en_curso", `● En curso (${nActivos})`],
              ["historial", `Historial / Entregados (${nEntregados})`],
              ["cancelados", `Cancelados (${nCancelados})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTabPedidos(id)}
              className={`shrink-0 rounded-lg px-4 py-2 transition ${
                tabPedidos === id ? "bg-[#E2781E] text-white shadow-lg" : "text-[#9CA3AF] hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative min-w-0 lg:min-w-[320px] lg:flex-1 lg:max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
            <IconSearch className="h-4 w-4" />
          </span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por producto, código # o tracking…"
            className="h-11 w-full rounded-xl border border-white/10 bg-[#1D1B19] py-2.5 pl-9 pr-4 font-heading text-xs uppercase tracking-wider text-white outline-none placeholder:text-white/35 focus:border-[#E2781E] [&::-webkit-search-cancel-button]:hidden"
            aria-label="Buscar pedidos"
          />
        </label>
      </div>

      {cargandoPedidos ? (
        <p className="py-10 text-center text-sm text-[#9CA3AF]">Cargando pedidos…</p>
      ) : pedidos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 bg-[#1D1B19] py-12 text-center text-sm text-[#9CA3AF]">
          Todavía no tenés pedidos guardados. Iniciá sesión antes de enviar el carrito por WhatsApp para que quede
          registrado acá.
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#1D1B19] p-12 text-center font-heading text-sm uppercase tracking-wide text-[#9CA3AF]">
          No se encontraron pedidos con el criterio seleccionado.
        </div>
      ) : (
        <ul className="space-y-6">
          {pedidosFiltrados.map((p) => {
            const badge = badgePedido(p);
            const pendiente = pedidoTieneConfirmacionPendienteCliente(p);
            const recienOk = pedidosConfirmados.includes(p.id);
            const alertaStock = pendiente && !recienOk;
            const etapa = !alertaStock && !recienOk ? copyEtapa(p.status) : null;

            return (
              <li
                key={p.id}
                className={`space-y-3 rounded-xl border bg-[#151311] p-3 shadow-lg sm:p-4 ${
                  alertaStock ? "border-[#E2781E]/50 border-l-4 border-l-[#E2781E]" : "border-white/10"
                }`}
              >
                <div className="flex flex-col justify-between gap-2 border-b border-white/[0.08] pb-3 sm:flex-row sm:items-center">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-heading text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF] sm:text-[11px]">
                    <span>Código de pedido:</span>
                    <span className="font-mono text-xs font-black text-white sm:text-sm">#{p.id}</span>
                    <span className="text-[#6B7280]">· {textoFechaPedido(p)}</span>
                  </p>
                  <span
                    className={`inline-flex self-start items-center gap-1.5 rounded-md border px-2.5 py-1 font-heading text-[10px] font-bold uppercase tracking-wider sm:self-auto sm:text-[11px] ${badge.className}`}
                  >
                    {alertaStock && <span aria-hidden>🔔</span>}
                    {alertaStock ? badge.text : `● ${badge.text}`}
                  </span>
                </div>

                {!alertaStock && <CuentaExpedicionStepper status={p.status} />}

                {etapa && (
                  <div className="flex flex-col justify-between gap-2 rounded-lg border border-white/10 bg-[#1a1714] p-3 sm:flex-row sm:items-center">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E2781E]/25 bg-[#E2781E]/10 text-lg text-[#E2781E]">
                        {p.status === "en_preparacion" ? "🧵" : "📦"}
                      </span>
                      <div>
                        <p className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#E8A882]">
                          {etapa.kicker}
                        </p>
                        <p className="mt-0.5 text-xs text-[#D1D5DB]">{etapa.detail}</p>
                      </div>
                    </div>
                    <p className="shrink-0 text-right font-heading text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                      Despacho previsto
                      <span className="mt-0.5 block text-xs normal-case text-white">{etapa.despacho}</span>
                    </p>
                  </div>
                )}

                {alertaStock && (
                  <div className="rounded-lg bg-[#E2781E] px-4 py-3.5 sm:px-5 sm:py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
                      <div className="flex min-w-0 items-start gap-2.5 text-black">
                        <span className="mt-0.5 text-lg font-bold" aria-hidden>
                          ⚠
                        </span>
                        <div>
                          <h4 className="font-heading text-[11px] font-black uppercase tracking-wide sm:text-xs">
                            Aviso de expedición técnica
                          </h4>
                          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-black/85 sm:text-xs">
                            {p.motivoModificacion?.trim() ||
                              "La tienda realizó un ajuste en tu pedido (actualización de stock). Revisá el nuevo detalle y confirmá para avanzar a preparación."}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          disabled={accionPedidoId === p.id}
                          onClick={() => onConfirmarPedido(p)}
                          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#151311] px-4 font-heading text-[10px] font-bold uppercase tracking-wide text-white hover:bg-black disabled:opacity-50 sm:whitespace-nowrap"
                        >
                          {accionPedidoId === p.id
                            ? "Procesando…"
                            : "✓ Aceptar y confirmar nuevo pedido"}
                        </button>
                        <a
                          href={urlWhatsAppTiendaPedido(p.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#F3E8DC] px-4 font-heading text-[10px] font-bold uppercase tracking-wide text-[#151311] hover:bg-[#e8dcc8] sm:whitespace-nowrap"
                        >
                          <IconWhatsApp className="h-4 w-4 text-[#151311]" />
                          Hablar con el taller
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {recienOk && !alertaStock && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 font-heading text-xs font-bold uppercase tracking-wide text-emerald-400">
                    ✓ Pedido confirmado. El taller avanza a preparación.
                  </div>
                )}

                <CuentaPedidoDetalle pedido={p} productos={productos} alertaStock={alertaStock} />
              </li>
            );
          })}
        </ul>
      )}

      <section className="flex flex-col gap-4 rounded-xl border border-white/10 bg-[#151311] p-4 shadow-lg lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#1a1714] text-[#D1D5DB]">
            <IconShield className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <span className="font-heading text-[10px] font-bold uppercase tracking-[0.12em] text-[#E2781E]">
              Protocolo de respaldo y campo
            </span>
            <h3 className="mt-1 font-heading text-base font-black uppercase leading-tight text-white sm:text-lg">
              Garantía de expedición Sangre Nómade
            </h3>
            <p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#9CA3AF]">
              Todo calzado y membrana técnica cuenta con 6 meses de garantía oficial y cambio de talle sin costo.
              Operamos con soporte directo desde nuestro taller en Córdoba.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-lg border border-white/12 bg-[#1a1714] px-5 font-heading text-[10px] font-bold uppercase tracking-wide text-[#E5E7EB] hover:border-white/25"
          >
            Volver a la tienda
          </button>
          <a
            href={urlWhatsAppTiendaConsultaGeneral()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-[#E2781E] px-5 font-heading text-[10px] font-bold uppercase tracking-wide text-black hover:bg-[#C96614]"
          >
            Asesoramiento técnico directo
          </a>
        </div>
      </section>
    </div>
  );
}
