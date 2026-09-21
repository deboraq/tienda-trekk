"use client";

import type { PedidoEstado } from "../../types";
import { PEDIDO_FLUJO_NORMAL, indiceEnFlujoNormal } from "../../lib/pedidos";
import { IconTruck } from "../storefront/Icons";

export function formatTelAR(digits?: string): string {
  if (!digits) return "—";
  if (digits.startsWith("549") && digits.length >= 12) {
    return `+54 9 ${digits.slice(3, 6)} ${digits.slice(6, 9)}-${digits.slice(9)}`;
  }
  return `+${digits}`;
}

export function BadgeEstado({ estado }: { estado: PedidoEstado }) {
  const configs: Record<
    PedidoEstado,
    { label: string; color: string }
  > = {
    recibido: {
      label: "PEDIDO RECIBIDO",
      color: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    },
    en_preparacion: {
      label: "EN PREPARACIÓN",
      color: "bg-orange-500/10 text-orange-400 border-orange-500/30",
    },
    enviado: {
      label: "ENVIADO",
      color: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    },
    entregado: {
      label: "ENTREGADO",
      color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    },
    cancelado: {
      label: "CANCELADO",
      color: "bg-red-500/10 text-red-400 border-red-500/30",
    },
  };
  const current = configs[estado];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 font-heading text-[10px] font-bold uppercase tracking-wider ${current.color}`}
    >
      • {current.label}
    </span>
  );
}

const STEPPER_COPY: Record<
  Exclude<PedidoEstado, "cancelado">,
  { title: string; done: string; active: string; pending: string }
> = {
  recibido: {
    title: "1. RECIBIDO",
    done: "Confirmado",
    active: "Orden registrada",
    pending: "Pendiente",
  },
  en_preparacion: {
    title: "2. EN PREPARACIÓN",
    done: "Listo",
    active: "Armando el paquete",
    pending: "Pendiente",
  },
  enviado: {
    title: "3. ENVIADO",
    done: "En transporte",
    active: "En transporte",
    pending: "Pendiente",
  },
  entregado: {
    title: "4. ENTREGADO",
    done: "Completado",
    active: "Entregado",
    pending: "Pendiente",
  },
};

export function PedidoStepper({ status }: { status: PedidoEstado }) {
  if (status === "cancelado") {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-950/30 px-4 py-3">
        <p className="font-heading text-xs font-bold uppercase tracking-wide text-red-400">
          Pedido cancelado
        </p>
        <p className="mt-1 text-xs text-[#9CA3AF]">
          Si no coincide con lo acordado, escribinos por WhatsApp.
        </p>
      </div>
    );
  }

  const idx = indiceEnFlujoNormal(status);

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#151311] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-heading text-xs font-bold uppercase tracking-wider text-[#E8A882]">
          <IconTruck className="h-4 w-4" />
          Estado del pedido
        </p>
        <p className="text-[11px] text-[#9CA3AF]">Paso {idx + 1} de 4 en curso</p>
      </div>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PEDIDO_FLUJO_NORMAL.map((step, i) => {
          const copy = STEPPER_COPY[step as Exclude<PedidoEstado, "cancelado">];
          const hecho = i < idx;
          const actual = i === idx;
          return (
            <div
              key={step}
              className={`min-w-0 rounded-lg border px-3.5 py-3.5 ${
                actual
                  ? "border-[#E2781E]/55 bg-[#E2781E]/10"
                  : hecho
                    ? "border-white/10 bg-[#1D1B19]"
                    : "border-white/[0.08] bg-[#1D1B19]"
              }`}
            >
              <p
                className={`flex items-center gap-2 font-heading text-[11px] font-bold uppercase tracking-wide ${
                  actual ? "text-[#E8A882]" : hecho ? "text-white" : "text-[#6B7280]"
                }`}
              >
                {hecho ? (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-black">
                    ✓
                  </span>
                ) : (
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      actual ? "bg-[#E2781E] text-black" : "bg-white/10 text-[#6B7280]"
                    }`}
                  >
                    {i + 1}
                  </span>
                )}
                {copy.title}
              </p>
              <p
                className={`mt-1.5 pl-7 text-[11px] ${
                  actual ? "text-[#E8A882]" : hecho ? "italic text-emerald-400" : "text-[#6B7280]"
                }`}
              >
                {hecho ? copy.done : actual ? copy.active : copy.pending}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
