"use client";

import { useState } from "react";
import type { Pedido, Product } from "../../types";
import { formatARS } from "../../lib/brand";
import { urlWhatsAppTiendaPedido } from "../../lib/whatsapp";
import { IconWhatsApp } from "../storefront/Icons";

type Props = {
  pedido: Pedido;
  productos: Product[];
  alertaStock: boolean;
};

function subtotalItems(p: Pedido): number {
  return p.items.reduce((s, it) => s + (it.lineTotal || it.quantity * it.unitPrice), 0);
}

function lineaCategoria(productId: string, productos: Product[], alertaStock: boolean, qty: number): string | null {
  const prod = productos.find((x) => x.id === productId);
  if (alertaStock) {
    const cat = prod?.category?.trim();
    const base = cat ? cat.toUpperCase() : "KIT RECONFIGURADO";
    return `${base} · ${qty} ${qty === 1 ? "unidad disponible en taller" : "unidades disponibles en taller"}`;
  }
  if (!prod) return null;
  const desc = prod.description?.trim();
  if (desc) return desc.toUpperCase();
  const cat = prod.category?.trim();
  return cat ? cat.toUpperCase() : null;
}

function subtituloItem(productId: string, productos: Product[], alertaStock: boolean): string | null {
  if (!alertaStock) return null;
  const prod = productos.find((x) => x.id === productId);
  const desc = prod?.description?.trim();
  if (desc && desc.length < 120) return desc;
  return "Reemplazo o ajuste autorizado en taller según stock disponible.";
}

function textoEstadoPago(status: Pedido["status"]): string {
  if (status === "recibido") return "Registrado · pendiente de taller";
  if (status === "cancelado") return "Pedido cancelado";
  return "Aprobado y asignado";
}

const btnPieClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-white/12 bg-[#151311] px-4 font-heading text-[10px] font-bold uppercase tracking-[0.06em] text-[#E5E7EB] hover:border-white/25";

function FilaProducto({
  it,
  idx,
  productos,
  alertaStock,
  precioDerecha,
}: {
  it: Pedido["items"][0];
  idx: number;
  productos: Product[];
  alertaStock: boolean;
  precioDerecha?: { label: string; monto: number };
}) {
  const img = productos.find((x) => x.id === it.productId)?.image;
  const cat = lineaCategoria(it.productId, productos, alertaStock, it.quantity);
  const sub = subtituloItem(it.productId, productos, alertaStock);

  return (
    <div
      className={`flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 ${
        idx > 0 ? "border-t border-white/[0.08] pt-4" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="h-[5.25rem] w-[5.25rem] shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/40 sm:h-[5.75rem] sm:w-[5.75rem]">
          {img ? (
            <img src={img} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-heading text-[10px] text-[#6B7280]">SN</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {cat && (
            <p className="font-heading text-[10px] font-bold uppercase leading-snug tracking-[0.08em] text-[#E2781E] sm:text-[11px]">
              {cat}
            </p>
          )}
          <h4 className="mt-1 font-heading text-base font-black uppercase leading-snug tracking-wide text-white sm:text-lg">
            {it.name}
          </h4>
          {sub && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#9CA3AF] sm:text-xs">{sub}</p>
          )}
          {!alertaStock && (
            <p className="mt-1.5 font-heading text-[11px] font-bold uppercase tracking-wide text-[#9CA3AF]">
              Cantidad:{" "}
              <span className="text-white">
                {it.quantity} {it.quantity === 1 ? "unidad" : "unidades"}
              </span>{" "}
              · ${formatARS(it.unitPrice)} c/u
            </p>
          )}
        </div>
      </div>
      {precioDerecha && (
        <div className="shrink-0 text-left sm:w-[11.5rem] sm:text-right">
          <p className="font-heading text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
            {precioDerecha.label}
          </p>
          <p className="mt-1 font-heading text-2xl font-black leading-none text-[#E2781E] sm:text-[1.65rem]">
            ${formatARS(precioDerecha.monto)} <span className="text-sm font-black">ARS</span>
          </p>
        </div>
      )}
    </div>
  );
}

export function CuentaPedidoDetalle({ pedido: p, productos, alertaStock }: Props) {
  const [copiado, setCopiado] = useState(false);
  const subtotal = subtotalItems(p);
  const envioMonto = Math.max(0, p.total - subtotal);

  const transporte = p.transporte?.trim() || "Andreani priority express";
  const guia = p.guiaTracking?.trim();
  const estimada =
    p.fechaEntregaEstimada?.trim() ||
    "Te avisamos por WhatsApp la ventana de entrega en tu domicilio.";

  const copiarGuia = () => {
    if (!guia) return;
    void navigator.clipboard.writeText(guia);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2000);
  };

  const urlSeguimiento =
    guia && /^[A-Za-z0-9-]+$/.test(guia)
      ? `https://www.andreani.com/#!/informacionEnvio/${encodeURIComponent(guia)}`
      : urlWhatsAppTiendaPedido(p.id);

  const mostrarBloqueEnvio = !alertaStock && (p.status === "enviado" || (p.status === "entregado" && !!guia));

  if (alertaStock) {
    return (
      <div className="rounded-lg border border-white/10 bg-[#1a1714] px-3 py-4 sm:px-4 sm:py-4">
        {p.items.map((it, idx) => (
          <FilaProducto
            key={`${p.id}-${idx}`}
            it={it}
            idx={idx}
            productos={productos}
            alertaStock
            precioDerecha={
              idx === p.items.length - 1
                ? { label: "Importe total ajustado", monto: p.total }
                : undefined
            }
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mostrarBloqueEnvio && (
        <div className="rounded-lg border border-[#E2781E]/30 bg-[#1a1714] px-4 py-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0 space-y-1 font-heading text-[10px] uppercase tracking-wide text-[#9CA3AF]">
              <p>
                Correo designado · <span className="font-bold text-[#E2781E]">{transporte}</span>
              </p>
              <p>
                Número de guía:{" "}
                {guia ? (
                  <>
                    <span className="font-mono font-bold text-white">{guia}</span>{" "}
                    <button type="button" onClick={copiarGuia} className="text-[#E2781E]">
                      {copiado ? "✓ Copiado" : "Copiar código"}
                    </button>
                  </>
                ) : (
                  <span className="text-[#D1D5DB]">en gestión</span>
                )}
              </p>
              <p className="text-[#6B7280]">🕒 {estimada}</p>
            </div>
            <a
              href={urlSeguimiento}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-[#E2781E] px-5 font-heading text-[11px] font-bold uppercase text-black hover:bg-[#C96614]"
            >
              📍 Seguir envío en vivo
            </a>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-white/10 bg-[#1a1714]">
        <div className="flex flex-col lg:flex-row lg:items-stretch">
          <div className="min-w-0 flex-1 px-3 py-4 sm:px-4">
            {p.items.map((it, idx) => (
              <FilaProducto
                key={`${p.id}-${idx}`}
                it={it}
                idx={idx}
                productos={productos}
                alertaStock={false}
              />
            ))}
          </div>
          <aside className="border-t border-white/10 px-3 py-4 sm:px-4 lg:w-[15.5rem] lg:shrink-0 lg:border-l lg:border-t-0 xl:w-[16.5rem]">
            <div className="space-y-2 font-heading text-[10px] font-bold uppercase tracking-wide text-[#9CA3AF]">
              <div className="flex justify-between gap-3">
                <span>Subtotal equipos:</span>
                <span className="text-white">${formatARS(subtotal)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="leading-snug">Envío prioritario Andes:</span>
                <span className={`text-right ${envioMonto <= 0 ? "text-emerald-400" : "text-white"}`}>
                  {envioMonto <= 0 ? "Gratis bonificado" : `$${formatARS(envioMonto)}`}
                </span>
              </div>
            </div>
            <div className="my-3 border-t border-white/[0.08]" />
            <div className="flex items-end justify-between gap-2">
              <span className="pb-0.5 font-heading text-[10px] font-bold uppercase text-[#D1D5DB]">Total pagado:</span>
              <p className="text-right font-heading text-[1.5rem] font-black leading-none text-[#E2781E]">
                ${formatARS(p.total)} <span className="text-sm font-black">ARS</span>
              </p>
            </div>
            {p.status !== "cancelado" && (
              <>
                <div className="my-3 border-t border-white/[0.08]" />
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 font-heading text-[10px] font-bold uppercase text-[#9CA3AF]">
                    <span aria-hidden>✓</span>
                    {p.metodoPago?.trim() || "Transferencia bancaria"}
                  </p>
                  <p className="flex items-center gap-1.5 font-heading text-[10px] font-bold uppercase text-emerald-400">
                    <span aria-hidden>✓</span>
                    {textoEstadoPago(p.status)}
                  </p>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <a href={urlWhatsAppTiendaPedido(p.id)} target="_blank" rel="noopener noreferrer" className={btnPieClass}>
            📄 Descargar comprobante y garantía
          </a>
          <a href={urlWhatsAppTiendaPedido(p.id)} target="_blank" rel="noopener noreferrer" className={btnPieClass}>
            <IconWhatsApp className="h-4 w-4 text-[#25d366]" />
            Soporte WhatsApp sobre este pedido
          </a>
        </div>
        {(p.status === "enviado" || p.status === "entregado" || p.status === "en_preparacion") && (
          <p className="font-heading text-[10px] font-bold uppercase tracking-wide text-[#6B7280]">
            {p.status === "en_preparacion" ? "Modalidad: envío standard Andes" : "SLA despacho: 24 hs cumplido"}
          </p>
        )}
      </div>
    </div>
  );
}
