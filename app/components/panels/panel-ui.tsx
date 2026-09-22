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
    title: "1. Recibido",
    done: "Confirmado",
    active: "Orden registrada",
    pending: "Pendiente",
  },
  en_preparacion: {
    title: "2. En taller",
    done: "Listo y empacado",
    active: "Armando el paquete",
    pending: "Pendiente",
  },
  enviado: {
    title: "3. Enviado",
    done: "En transporte",
    active: "En transporte · activo",
    pending: "Pendiente",
  },
  entregado: {
    title: "4. Entregado",
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
  const pct = idx <= 0 ? 0 : (idx / 3) * 100;

  return (
    <div className="relative py-3">
      <div className="relative grid grid-cols-4 text-center">
        <div className="pointer-events-none absolute left-[12%] right-[12%] top-3 h-0.5 bg-white/10">
          <div className="h-full bg-[#E2781E] transition-all" style={{ width: `${pct}%` }} />
        </div>
        {PEDIDO_FLUJO_NORMAL.map((step, i) => {
          const copy = STEPPER_COPY[step as Exclude<PedidoEstado, "cancelado">];
          const hecho = i < idx;
          const actual = i === idx;
          const sub = hecho ? copy.done : actual ? copy.active : copy.pending;
          return (
            <div key={step} className="relative z-10 flex flex-col items-center px-1">
              <span
                className={`mb-1.5 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                  hecho || actual
                    ? "bg-[#E2781E] text-white"
                    : "bg-white/10 text-[#6B7280]"
                }`}
              >
                {hecho ? "✓" : actual && step === "enviado" ? (
                  <IconTruck className="h-3 w-3" />
                ) : actual ? (
                  "●"
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`font-heading text-[11px] font-bold uppercase ${
                  actual ? "text-[#E2781E]" : hecho ? "text-white" : "text-[#6B7280]"
                }`}
              >
                {copy.title}
              </span>
              <span
                className={`mt-0.5 text-[9px] uppercase ${
                  actual ? "text-[#E8A882]" : hecho ? "text-[#9CA3AF]" : "text-[#6B7280]"
                }`}
              >
                {hecho ? `✓ ${sub}` : actual ? `● ${sub}` : sub}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
