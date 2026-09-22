"use client";

import type { PedidoEstado } from "../../types";
import { indiceEnFlujoNormal } from "../../lib/pedidos";

const PASOS = [
  { key: "recibido", titulo: "1. Recibido", hecho: "✓ Confirmado", pendiente: "Pendiente" },
  { key: "en_preparacion", titulo: "2. En taller", hecho: "✓ Listo y empacado", pendiente: "Pendiente" },
  { key: "enviado", titulo: "3. Enviado", hecho: "● En transporte - activo", pendiente: "Pendiente" },
  { key: "entregado", titulo: "4. Entregado", hecho: "✓ Completado", pendiente: "Pendiente" },
] as const;

export function CuentaExpedicionStepper({ status }: { status: PedidoEstado }) {
  if (status === "cancelado") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 font-heading text-xs font-bold uppercase tracking-wide text-red-400">
        Pedido cancelado
      </div>
    );
  }

  const idx = indiceEnFlujoNormal(status);
  const progreso = idx <= 0 ? 0 : idx >= 3 ? 100 : (idx / 3) * 100;

  return (
    <div className="py-1">
      <div className="relative grid grid-cols-4 gap-1 text-center sm:gap-2">
        <div
          className="pointer-events-none absolute left-[12%] right-[12%] top-3 z-0 h-0.5 bg-white/10"
          aria-hidden
        >
          <div
            className="h-full bg-[#E2781E] transition-all duration-500"
            style={{ width: `${progreso}%` }}
          />
        </div>
        {PASOS.map((paso, i) => {
          const hecho = i < idx;
          const actual = i === idx;
          return (
            <div key={paso.key} className="relative z-10 flex flex-col items-center px-0.5">
              <div
                className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold shadow ${
                  hecho || actual
                    ? "bg-[#E2781E] text-white"
                    : "bg-white/10 text-[#6B7280]"
                }`}
              >
                {hecho ? "✓" : actual && paso.key === "enviado" ? "🚚" : i + 1}
              </div>
              <span
                className={`font-heading text-[10px] font-bold uppercase leading-tight tracking-wide sm:text-[11px] ${
                  actual ? "text-[#E2781E]" : hecho ? "text-white" : "text-[#6B7280]"
                }`}
              >
                {paso.titulo}
              </span>
              <span className="mt-0.5 hidden font-heading text-[9px] uppercase tracking-wide text-[#9CA3AF] sm:block">
                {hecho ? paso.hecho : actual ? paso.hecho : paso.pendiente}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
