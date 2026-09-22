"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { getDb, getFirebaseAuth } from "../firebase/config";
import { docDataAPedido } from "../lib/pedidos";
import { urlWhatsAppTiendaConsultaGeneral } from "../lib/whatsapp";
import type { Pedido, Product } from "../types";
import Image from "next/image";
import { IconLogout, IconSearch, IconUserCircle, IconWhatsApp } from "./storefront/Icons";
import { NAV_DESKTOP } from "../lib/brand";
import { MiCuentaPedidos } from "./cuenta/MiCuentaPedidos";

type Props = {
  open: boolean;
  onClose: () => void;
  productos?: Product[];
};

function mensajeAuth(error: unknown): string {
  if (error instanceof FirebaseError) {
    const c = error.code;
    if (c === "auth/email-already-in-use") {
      return "Ese email ya está registrado. Probá iniciar sesión.";
    }
    if (c === "auth/weak-password") {
      return "La contraseña debe tener al menos 6 caracteres.";
    }
    if (c === "auth/invalid-credential" || c === "auth/wrong-password") {
      return "Email o contraseña incorrectos.";
    }
    if (c === "auth/user-not-found") {
      return "No hay cuenta con ese email.";
    }
    if (c === "auth/invalid-email") {
      return "Email inválido.";
    }
    if (c === "auth/operation-not-allowed") {
      return "Activá correo/contraseña en Firebase Authentication.";
    }
    if (c === "auth/too-many-requests") {
      return "Demasiados intentos. Probá más tarde.";
    }
    if (c === "auth/network-request-failed") {
      return "Sin conexión.";
    }
    if (c === "auth/invalid-api-key" || c === "auth/api-key-not-valid") {
      return "API key de Firebase inválida en este entorno.";
    }
    if (c === "permission-denied") {
      return "Permisos denegados. Revisá las reglas de Firestore.";
    }
  }
  return "Error. Revisá la consola (F12).";
}

const inputClass =
  "mt-1.5 w-full rounded-lg border border-white/10 bg-[#151311] px-3.5 py-2.5 text-white outline-none placeholder:text-white/30 focus:border-[#E2781E]/50 focus:ring-1 focus:ring-[#E2781E]/30";

export function CuentaClientePanel({ open, onClose, productos = [] }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [modo, setModo] = useState<"login" | "registro">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(false);
  const [mostrarRecuperar, setMostrarRecuperar] = useState(false);
  const [recuperarEnviado, setRecuperarEnviado] = useState(false);
  const [accionPedidoId, setAccionPedidoId] = useState<string | null>(null);
  const [pedidosConfirmados, setPedidosConfirmados] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => unsub();
  }, [open]);

  useEffect(() => {
    if (!open || !user) {
      setPedidos([]);
      return;
    }
    let cancel = false;
    (async () => {
      setCargandoPedidos(true);
      try {
        const q = query(
          collection(getDb(), "pedidos"),
          where("userId", "==", user.uid)
        );
        const snap = await getDocs(q);
        const list: Pedido[] = [];
        snap.forEach((d) => {
          const p = docDataAPedido(d.id, d.data() as Record<string, unknown>);
          if (p) list.push(p);
        });
        list.sort((a, b) => {
          const ta = a.createdAt?.getTime() ?? 0;
          const tb = b.createdAt?.getTime() ?? 0;
          return tb - ta;
        });
        if (!cancel) setPedidos(list);
      } catch (e) {
        console.error(e);
        if (!cancel) setPedidos([]);
      } finally {
        if (!cancel) setCargandoPedidos(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open, user]);

  useEffect(() => {
    if (!open) {
      setError(null);
      setModo("login");
      setPassword("");
      setPassword2("");
      setMostrarRecuperar(false);
      setRecuperarEnviado(false);
      setPedidosConfirmados([]);
    }
  }, [open]);

  if (!open) return null;

  const aceptarPedidoModificado = async (p: Pedido): Promise<boolean> => {
    if (!user) return false;
    setAccionPedidoId(p.id);
    setError(null);
    try {
      await updateDoc(doc(getDb(), "pedidos", p.id), {
        confirmacionModificacion: "aceptada",
        confirmacionClienteVistaPorAdmin: false,
        updatedAt: serverTimestamp(),
      });
      setPedidos((prev) =>
        prev.map((x) =>
          x.id === p.id
            ? {
                ...x,
                confirmacionModificacion: "aceptada",
                confirmacionClienteVistaPorAdmin: false,
                updatedAt: new Date(),
              }
            : x
        )
      );
      return true;
    } catch (e) {
      console.error(e);
      setError(
        "No pudimos registrar tu confirmación. Probá de nuevo o escribinos por WhatsApp."
      );
      return false;
    } finally {
      setAccionPedidoId(null);
    }
  };

  const confirmarPedido = async (p: Pedido) => {
    setPedidosConfirmados((prev) => (prev.includes(p.id) ? prev : [...prev, p.id]));
    const ok = await aceptarPedidoModificado(p);
    if (!ok) {
      setPedidosConfirmados((prev) => prev.filter((id) => id !== p.id));
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmailAndPassword(
        getFirebaseAuth(),
        email.trim(),
        password
      );
      setPassword("");
      setPassword2("");
    } catch (err) {
      console.error(err);
      setError(mensajeAuth(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRecuperarPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setRecuperarEnviado(false);
    const mail = email.trim();
    if (!mail) {
      setError("Ingresá el email de tu cuenta.");
      return;
    }
    setLoading(true);
    try {
      await sendPasswordResetEmail(getFirebaseAuth(), mail);
      setRecuperarEnviado(true);
    } catch (err) {
      console.error(err);
      setError(mensajeAuth(err));
    } finally {
      setLoading(false);
    }
  };

  const handleRegistro = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      await createUserWithEmailAndPassword(
        getFirebaseAuth(),
        email.trim(),
        password
      );
      setPassword("");
      setPassword2("");
    } catch (err) {
      console.error(err);
      setError(mensajeAuth(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[215] overflow-x-hidden overflow-y-auto overscroll-contain bg-[#151311] text-[#F3F4F6]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cuenta-cliente-title"
    >
      <header className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#2C2926]">
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-4 py-3 md:grid md:grid-cols-[1fr_28rem_1fr] md:gap-4">
          <button type="button" onClick={onClose} className="flex shrink-0 items-center gap-3 text-left">
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
            </span>
          </button>
          <div className="hidden md:block">
            <label className="flex h-14 w-full items-center gap-2.5 rounded-md border border-white/12 bg-[#1a1714] px-2.5">
              <span className="shrink-0 text-white/40">
                <IconSearch className="h-[18px] w-[18px]" />
              </span>
              <input
                type="search"
                placeholder="BUSCAR EQUIPAMIENTO, BOTAS, PACKS..."
                className="h-10 min-w-0 flex-1 rounded-[3px] border border-white/18 bg-transparent px-3 font-heading text-[13px] uppercase tracking-wider text-[#D1D5DB] outline-none placeholder:text-white/38 focus:border-white/30 [&::-webkit-search-cancel-button]:hidden"
                aria-label="Buscar equipamiento en la tienda"
              />
            </label>
          </div>
          <div className="ml-auto flex h-10 items-center justify-end gap-4 md:ml-0 md:gap-5">
            <div className="flex h-10 items-center gap-3">
              <a
                href={urlWhatsAppTiendaConsultaGeneral()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-[#1d1b19] px-3 font-heading text-[11px] font-bold uppercase tracking-[0.12em] text-white hover:border-[#25d366]/40"
              >
                <IconWhatsApp className="h-4 w-4 text-[#25d366]" />
                WhatsApp
              </a>
              {user && <span className="hidden h-6 w-px bg-white/20 lg:block" aria-hidden />}
            </div>
            {user && (
              <span className="hidden h-10 items-center gap-2.5 lg:inline-flex">
                <IconUserCircle className="h-8 w-8 text-[#E8B892]" />
                <span className="max-w-[14rem] truncate font-heading text-[12px] font-semibold uppercase tracking-wide text-white">
                  {user.email}
                </span>
              </span>
            )}
            <button
              type="button"
              onClick={() => (user ? signOut(getFirebaseAuth()) : onClose())}
              className="rounded-md p-2 text-[#9CA3AF] hover:text-white"
              aria-label={user ? "Cerrar sesión" : "Volver a la tienda"}
            >
              <IconLogout className="h-5 w-5" />
            </button>
          </div>
        </div>
        <nav className="border-t border-white/5 bg-[#1D1B19]">
          <div className="mx-auto flex max-w-[1400px] items-center gap-6 overflow-x-auto px-4 py-2.5 font-heading text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
            {NAV_DESKTOP.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={onClose}
                className={`shrink-0 hover:text-[#E2781E] ${n.id === "catalogo" ? "text-[#E2781E]" : ""}`}
              >
                {n.label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {!authReady ? (
          <p className="py-16 text-center text-sm text-[#9CA3AF]">Cargando…</p>
        ) : !user ? (
          <div className="mx-auto max-w-md space-y-4">
            <h1 id="cuenta-cliente-title" className="font-heading text-2xl font-bold uppercase tracking-wider text-white">
              Mi cuenta
            </h1>
            <div className="flex gap-1 rounded-lg border border-white/10 bg-[#1D1B19] p-1">
              <button
                type="button"
                className={`flex-1 rounded-md py-2.5 font-heading text-xs font-bold uppercase tracking-wider ${
                  modo === "login" ? "bg-[#E2781E] text-black" : "text-[#9CA3AF]"
                }`}
                onClick={() => {
                  setModo("login");
                  setError(null);
                }}
              >
                Entrar
              </button>
              <button
                type="button"
                className={`flex-1 rounded-md py-2.5 font-heading text-xs font-bold uppercase tracking-wider ${
                  modo === "registro" ? "bg-[#E2781E] text-black" : "text-[#9CA3AF]"
                }`}
                onClick={() => {
                  setModo("registro");
                  setError(null);
                }}
              >
                Registrarme
              </button>
            </div>
            <p className="text-sm text-[#9CA3AF]">
              Con una cuenta, al enviar el pedido por WhatsApp guardamos el carrito y podés ver el estado acá.
            </p>
            {modo === "login" && mostrarRecuperar ? (
              <form onSubmit={handleRecuperarPassword} className="space-y-4 rounded-xl border border-white/[0.08] bg-[#1D1B19] p-5">
                <p className="text-xs text-[#9CA3AF]">Te enviamos un enlace a tu correo para elegir una contraseña nueva.</p>
                <label className="block">
                  <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#E2781E]">Email de la cuenta</span>
                  <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
                </label>
                {recuperarEnviado && (
                  <p className="rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-300">
                    Si ese email está registrado, vas a recibir un enlace.
                  </p>
                )}
                {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-xs text-red-300">{error}</p>}
                <button type="submit" disabled={loading} className="w-full rounded-lg bg-[#E2781E] py-3 font-heading text-sm font-bold uppercase tracking-wide text-black hover:bg-[#C96614] disabled:opacity-55">
                  {loading ? "Enviando…" : "Enviar enlace"}
                </button>
                <button type="button" className="w-full text-center text-xs text-[#E8A882]" onClick={() => { setMostrarRecuperar(false); setError(null); setRecuperarEnviado(false); }}>
                  Volver al inicio de sesión
                </button>
              </form>
            ) : modo === "login" ? (
              <form onSubmit={handleLogin} className="space-y-4 rounded-xl border border-white/[0.08] bg-[#1D1B19] p-5">
                <label className="block">
                  <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#E2781E]">Email</span>
                  <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
                </label>
                <label className="block">
                  <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#E2781E]">Contraseña</span>
                  <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required />
                </label>
                {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-xs text-red-300">{error}</p>}
                <button type="submit" disabled={loading} className="w-full rounded-lg bg-[#E2781E] py-3 font-heading text-sm font-bold uppercase tracking-wide text-black hover:bg-[#C96614] disabled:opacity-55">
                  {loading ? "Entrando…" : "Entrar"}
                </button>
                <button type="button" className="w-full text-center text-xs text-[#9CA3AF] hover:text-white" onClick={() => { setMostrarRecuperar(true); setError(null); setRecuperarEnviado(false); }}>
                  ¿Olvidaste tu contraseña?
                </button>
              </form>
            ) : (
              <form onSubmit={handleRegistro} className="space-y-4 rounded-xl border border-white/[0.08] bg-[#1D1B19] p-5">
                <label className="block">
                  <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#E2781E]">Email</span>
                  <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
                </label>
                <label className="block">
                  <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#E2781E]">Contraseña</span>
                  <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required minLength={6} />
                </label>
                <label className="block">
                  <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#E2781E]">Repetir contraseña</span>
                  <input type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} className={inputClass} required minLength={6} />
                </label>
                {error && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-xs text-red-300">{error}</p>}
                <button type="submit" disabled={loading} className="w-full rounded-lg bg-[#E2781E] py-3 font-heading text-sm font-bold uppercase tracking-wide text-black hover:bg-[#C96614] disabled:opacity-55">
                  {loading ? "Creando cuenta…" : "Crear cuenta"}
                </button>
              </form>
            )}
          </div>
        ) : (
          <MiCuentaPedidos
            user={user}
            pedidos={pedidos}
            cargandoPedidos={cargandoPedidos}
            productos={productos}
            error={error}
            accionPedidoId={accionPedidoId}
            pedidosConfirmados={pedidosConfirmados}
            onConfirmarPedido={(p) => void confirmarPedido(p)}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}
