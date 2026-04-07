"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { collection, getDocs, query, where } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import { getDb, getFirebaseAuth } from "../firebase/config";
import {
  docDataAPedido,
  etiquetaEstadoPedido,
  PEDIDO_FLUJO_NORMAL,
  indiceEnFlujoNormal,
} from "../lib/pedidos";
import type { Pedido, PedidoEstado } from "../types";

type Props = {
  open: boolean;
  onClose: () => void;
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
  "mt-1.5 w-full rounded-xl border border-[#2F3E46]/12 bg-white px-3.5 py-2.5 text-[#2F3E46] shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-[#2F3E46]/35 focus:border-[#53634B] focus:ring-2 focus:ring-[#53634B]/20";

function CronologiaEstadosPedido({ status }: { status: PedidoEstado }) {
  if (status === "cancelado") {
    return (
      <div className="rounded-xl border border-red-200/90 bg-red-50/95 px-3 py-3 text-xs text-red-900">
        <p className="font-heading font-bold uppercase tracking-wide text-red-950">
          Pedido cancelado
        </p>
        <p className="mt-1.5 leading-relaxed text-red-800/95">
          Si no coincide con lo acordado, escribinos por WhatsApp.
        </p>
      </div>
    );
  }

  const idx = indiceEnFlujoNormal(status);

  return (
    <ol className="list-none space-y-0 p-0">
      {PEDIDO_FLUJO_NORMAL.map((step, i) => {
        const hecho = i < idx;
        const actual = i === idx;
        const pendiente = i > idx;
        const ultimo = i === PEDIDO_FLUJO_NORMAL.length - 1;
        return (
          <li key={step} className="flex gap-3">
            <div className="flex w-7 flex-col items-center pt-0.5">
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold leading-none ${
                  hecho
                    ? "border-[#53634B] bg-[#53634B] text-white"
                    : actual
                      ? "border-[#A65D37] bg-white text-[#A65D37] shadow-[0_0_0_3px_rgba(166,93,55,0.18)]"
                      : "border-[#2F3E46]/15 bg-[#fefdfb] text-[#2F3E46]/35"
                }`}
              >
                {hecho ? "✓" : pendiente ? String(i + 1) : "●"}
              </span>
              {!ultimo && (
                <span
                  className={`block w-0.5 flex-1 rounded-full ${hecho ? "bg-[#53634B]/35" : "bg-[#2F3E46]/12"}`}
                  style={{ minHeight: "1rem" }}
                  aria-hidden
                />
              )}
            </div>
            <div className={`min-w-0 flex-1 ${ultimo ? "pb-0" : "pb-3"} pt-0.5`}>
              <p
                className={`text-sm font-medium ${
                  actual ? "text-[#2F3E46]" : hecho ? "text-[#2F3E46]/80" : "text-[#2F3E46]/42"
                }`}
              >
                {etiquetaEstadoPedido(step)}
              </p>
              {actual && (
                <p className="mt-0.5 font-heading text-[10px] font-bold uppercase tracking-wide text-[#A65D37]">
                  Estado actual
                </p>
              )}
              {pendiente && (
                <p className="mt-0.5 text-[10px] text-[#2F3E46]/38">Pendiente</p>
              )}
              {hecho && !actual && (
                <p className="mt-0.5 text-[10px] text-[#53634B]/75">Completado</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function CuentaClientePanel({ open, onClose }: Props) {
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
  const [pedidoExpandidoId, setPedidoExpandidoId] = useState<string | null>(null);

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
      setPedidoExpandidoId(null);
    }
  }, [open]);

  if (!open) return null;

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
      className="fixed inset-0 z-[215] flex items-center justify-center bg-[#2F3E46]/55 p-3 backdrop-blur-[2px] sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="cuenta-cliente-title"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[#2F3E46]/12 bg-[#F2EBD3]/40 shadow-[0_24px_64px_-16px_rgba(47,62,70,0.45)] backdrop-blur-sm sm:max-w-md"
        onClick={(ev) => ev.stopPropagation()}
      >
        <header className="shrink-0 border-b border-white/40 bg-[#53634B] px-4 py-4 text-[#F2EBD3] sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e8c9a8]">
                Sangre Nómade
              </p>
              <h2
                id="cuenta-cliente-title"
                className="font-heading text-lg font-bold uppercase tracking-wide text-white sm:text-xl"
              >
                Mi cuenta
              </h2>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-lg text-white transition-colors hover:bg-white/20"
              onClick={onClose}
              aria-label="Cerrar"
            >
              ✕
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#fefdfb] px-4 py-4 text-sm text-[#2F3E46] sm:px-5 sm:py-5">
          {!authReady ? (
            <p className="py-8 text-center text-sm italic text-[#2F3E46]/50">
              Cargando…
            </p>
          ) : !user ? (
            <div className="space-y-4">
              <div className="flex gap-1 rounded-2xl border border-[#2F3E46]/10 bg-[#2F3E46]/[0.06] p-1">
                <button
                  type="button"
                  className={`flex-1 rounded-xl py-2.5 font-heading text-xs font-bold uppercase tracking-wider transition-all ${
                    modo === "login"
                      ? "bg-[#fefdfb] text-[#2F3E46] shadow-md ring-1 ring-[#2F3E46]/10"
                      : "text-[#2F3E46]/65"
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
                  className={`flex-1 rounded-xl py-2.5 font-heading text-xs font-bold uppercase tracking-wider transition-all ${
                    modo === "registro"
                      ? "bg-[#fefdfb] text-[#2F3E46] shadow-md ring-1 ring-[#2F3E46]/10"
                      : "text-[#2F3E46]/65"
                  }`}
                  onClick={() => {
                    setModo("registro");
                    setError(null);
                  }}
                >
                  Registrarme
                </button>
              </div>

              <p className="text-xs leading-relaxed text-[#2F3E46]/70">
                Con una cuenta, al enviar el pedido por WhatsApp guardamos el
                carrito en la nube y podés ver el estado acá (recibido, envío,
                etc.).
              </p>

              {modo === "login" ? (
                <form
                  onSubmit={handleLogin}
                  className="space-y-4 rounded-2xl border border-[#2F3E46]/10 bg-white p-5 shadow-sm"
                >
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#53634B]">
                      Email
                    </span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#53634B]">
                      Contraseña
                    </span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </label>
                  {error && (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-[#53634B] py-3.5 font-heading text-sm font-bold uppercase tracking-wide text-white shadow-md transition-opacity hover:bg-[#3d4a38] disabled:opacity-55"
                  >
                    {loading ? "Entrando…" : "Entrar"}
                  </button>
                </form>
              ) : (
                <form
                  onSubmit={handleRegistro}
                  className="space-y-4 rounded-2xl border border-[#2F3E46]/10 bg-white p-5 shadow-sm"
                >
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#53634B]">
                      Email
                    </span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#53634B]">
                      Contraseña
                    </span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                      required
                      minLength={6}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#53634B]">
                      Repetir contraseña
                    </span>
                    <input
                      type="password"
                      autoComplete="new-password"
                      value={password2}
                      onChange={(e) => setPassword2(e.target.value)}
                      className={inputClass}
                      required
                      minLength={6}
                    />
                  </label>
                  {error && (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                      {error}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full rounded-xl bg-[#A65D37] py-3.5 font-heading text-sm font-bold uppercase tracking-wide text-white shadow-md transition-opacity hover:opacity-95 disabled:opacity-55"
                  >
                    {loading ? "Creando cuenta…" : "Crear cuenta"}
                  </button>
                </form>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#2F3E46]/10 pb-4">
                <span className="max-w-full truncate rounded-full border border-[#2F3E46]/10 bg-[#F2EBD3]/60 px-3 py-1.5 text-[11px] text-[#2F3E46]/80">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => signOut(getFirebaseAuth())}
                  className="rounded-full border-2 border-[#A65D37]/40 px-4 py-1.5 font-heading text-[11px] font-bold uppercase tracking-wide text-[#A65D37] transition-colors hover:bg-[#A65D37]/10"
                >
                  Salir
                </button>
              </div>

              <div>
                <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-[#2F3E46]">
                  Mis pedidos
                </h3>
                <p className="mt-1 text-xs text-[#2F3E46]/65">
                  El estado lo actualiza el equipo cuando confirman pago o envío.
                </p>
              </div>

              {cargandoPedidos ? (
                <p className="py-6 text-center text-sm italic text-[#2F3E46]/50">
                  Cargando pedidos…
                </p>
              ) : pedidos.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#2F3E46]/20 bg-white/80 py-10 text-center text-sm text-[#2F3E46]/55">
                  Todavía no tenés pedidos guardados. Iniciá sesión antes de
                  enviar el carrito por WhatsApp para que quede registrado acá.
                </div>
              ) : (
                <ul className="space-y-3">
                  {pedidos.map((p) => {
                    const expandido = pedidoExpandidoId === p.id;
                    return (
                      <li
                        key={p.id}
                        className="overflow-hidden rounded-2xl border border-[#2F3E46]/12 bg-white shadow-sm"
                      >
                        <button
                          type="button"
                          className="flex w-full items-start gap-2 border-b border-[#2F3E46]/8 bg-[#fefdfb] px-4 py-3 text-left transition-colors hover:bg-[#F2EBD3]/40"
                          onClick={() =>
                            setPedidoExpandidoId((id) =>
                              id === p.id ? null : p.id
                            )
                          }
                          aria-expanded={expandido}
                          aria-controls={`pedido-detalle-${p.id}`}
                          id={`pedido-cabecera-${p.id}`}
                        >
                          <span
                            className="mt-0.5 shrink-0 text-[#53634B] transition-transform duration-200"
                            style={{
                              transform: expandido ? "rotate(90deg)" : "rotate(0deg)",
                            }}
                            aria-hidden
                          >
                            ▸
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-heading text-[10px] font-bold uppercase tracking-wider text-[#A65D37]">
                              Pedido
                            </p>
                            <p className="text-xs font-medium text-[#2F3E46]">
                              {p.createdAt
                                ? p.createdAt.toLocaleString("es-AR", {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })
                                : "—"}
                            </p>
                            <p className="mt-1 text-[11px] text-[#2F3E46]/55">
                              Tocá para ver la cronología de estados
                            </p>
                          </div>
                          <span className="shrink-0 rounded-full bg-[#53634B]/14 px-2.5 py-1 text-center font-heading text-[10px] font-bold uppercase leading-tight tracking-wide text-[#2F3E46]">
                            {etiquetaEstadoPedido(p.status)}
                          </span>
                        </button>

                        <div
                          id={`pedido-detalle-${p.id}`}
                          role="region"
                          aria-labelledby={`pedido-cabecera-${p.id}`}
                          className="px-4 pb-3 pt-2"
                        >
                          <ul className="space-y-1 text-xs text-[#2F3E46]/85">
                            {p.items.map((it, i) => (
                              <li key={`${p.id}-${i}`}>
                                {it.name} × {it.quantity}{" "}
                                <span className="text-[#2F3E46]/50">
                                  (${it.lineTotal.toLocaleString("es-AR")})
                                </span>
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 border-t border-[#2F3E46]/8 pt-2 text-sm font-bold text-[#A65D37]">
                            Total: ${p.total.toLocaleString("es-AR")}
                          </p>

                          {expandido && (
                            <div className="mt-4 rounded-xl border border-[#2F3E46]/10 bg-[#F2EBD3]/25 p-3">
                              <p className="mb-3 font-heading text-[10px] font-bold uppercase tracking-wider text-[#2F3E46]/65">
                                Cronología del pedido
                              </p>
                              <CronologiaEstadosPedido status={p.status} />
                              <p className="mt-3 text-[10px] leading-relaxed text-[#2F3E46]/45">
                                El equipo va actualizando el estado; cuando cambie, verás el
                                progreso acá.
                              </p>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
