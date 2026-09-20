"use client";

import { useState, type FormEvent } from "react";
import { FOOTER_COLS } from "../../lib/brand";

type Props = {
  onCatalogo: (hint?: string) => void;
  onHelp: () => void;
  onAdmin?: () => void;
  mostrarAdmin: boolean;
};

export function StoreFooter({ onCatalogo, onHelp, onAdmin, mostrarAdmin }: Props) {
  const [email, setEmail] = useState("");
  const [ok, setOk] = useState(false);

  const unirse = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setOk(true);
  };

  return (
    <footer id="contacto" className="border-t border-white/8 bg-[#151311] pb-28 md:pb-0">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 md:grid-cols-4">
        {FOOTER_COLS.map((col) => (
          <details key={col.title} className="group" open>
            <summary className="cursor-pointer list-none border-b border-white/15 pb-2 font-heading text-sm font-bold uppercase tracking-[0.14em] text-[#E2781E] md:pointer-events-none md:cursor-default">
              {col.title}
              <span className="float-right md:hidden">▾</span>
            </summary>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l}>
                  <button
                    type="button"
                    onClick={() => onCatalogo()}
                    className="text-left text-sm text-[#D1D5DB]/80 hover:text-white"
                  >
                    {l}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        ))}
        <div>
          <h3 className="border-b border-white/15 pb-2 font-heading text-sm font-bold uppercase tracking-[0.14em] text-white">
            Contacto directo
          </h3>
          <p className="mt-3 text-sm font-semibold text-white">Refugio Base Córdoba Capital</p>
          <p className="mt-1 text-sm text-[#D1D5DB]/80">Atención Técnica & Retiro de Equipos</p>
          <p className="mt-1 text-sm text-[#E68C24]">+54 9 351 789-NOMADE (WhatsApp 24hs)</p>
          <p className="mt-4 font-heading text-[11px] font-bold uppercase tracking-[0.14em] text-white/70">
            Newsletter expediciones (10% off)
          </p>
          <form onSubmit={unirse} className="mt-2 flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu-email@montana.com"
              className="h-10 min-w-0 flex-1 rounded-md border border-white/10 bg-[#1D1B19] px-3 text-sm text-white outline-none placeholder:text-white/30"
            />
            <button
              type="submit"
              className="rounded-md bg-[#E2781E] px-3 font-heading text-xs font-bold uppercase tracking-wider text-black hover:bg-[#C96614]"
            >
              Unirme
            </button>
          </form>
          {ok && <p className="mt-2 text-xs text-[#E68C24]">Listo. Te vamos a escribir con las próximas salidas.</p>}
        </div>
      </div>
      <div className="border-t border-white/8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 text-[11px] text-white/45 md:flex-row md:items-center md:justify-between">
          <p className="font-heading uppercase tracking-[0.12em]">
            © 2026 Sangre Nómade. Todos los derechos reservados.
            <button type="button" onClick={onHelp} className="ml-2 hover:text-white">
              · Términos y Condiciones · Defensa del Consumidor · Políticas de Privacidad
            </button>
          </p>
          <p className="inline-flex items-center gap-2 font-heading uppercase tracking-[0.12em] text-[#E68C24]">
            <span aria-hidden>▣</span> Hasta 6 cuotas sin interés · Transferencia bancaria · MercadoPago
          </p>
        </div>
        {mostrarAdmin && onAdmin && (
          <div className="mx-auto max-w-7xl px-4 pb-4">
            <button
              type="button"
              onClick={onAdmin}
              className="font-heading text-[10px] uppercase tracking-[0.16em] text-white/30 hover:text-white/70"
            >
              Administrar tienda
            </button>
          </div>
        )}
      </div>
    </footer>
  );
}
