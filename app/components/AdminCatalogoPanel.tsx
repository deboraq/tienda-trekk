"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  collection,
  addDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { FirebaseError } from "firebase/app";
import { getDb, getFirebaseAuth, getFirebaseStorage } from "../firebase/config";

function esUrlImagenValida(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
  /** Categorías reales (sin "Todos") */
  categoriasProducto: string[];
  /** Vuelve a leer Firestore para refrescar la grilla */
  onCatalogoActualizado: () => void;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function mensajeFirebase(error: unknown): string {
  if (error instanceof FirebaseError) {
    const c = error.code;
    if (c === "auth/invalid-credential" || c === "auth/wrong-password") {
      return "Email o contraseña incorrectos. Si el usuario no existe, crealo en Firebase → Authentication → Usuarios.";
    }
    if (c === "auth/user-not-found") {
      return "No hay ningún usuario con ese email. En Firebase Console → Authentication → Usuarios → Agregar usuario.";
    }
    if (c === "auth/invalid-email") {
      return "El email no tiene un formato válido.";
    }
    if (c === "auth/user-disabled") {
      return "Esta cuenta está deshabilitada en Firebase.";
    }
    if (c === "auth/operation-not-allowed") {
      return "Activá «Correo electrónico / contraseña» en Firebase → Authentication → Método de acceso.";
    }
    if (c === "auth/too-many-requests") {
      return "Demasiados intentos. Probá más tarde.";
    }
    if (c === "auth/network-request-failed") {
      return "Sin conexión o Firebase no respondió. Revisá internet o el firewall.";
    }
    if (c === "auth/invalid-api-key" || c === "auth/api-key-not-valid") {
      return "La API key de Firebase en .env.local no es válida o no coincide con el proyecto.";
    }
    if (c === "permission-denied") {
      return "Firebase rechazó el guardado. Revisá que las reglas de Firestore permitan escribir con tu usuario y que el email coincida con el de las reglas.";
    }
    if (c === "storage/unauthorized") {
      return "No tenés permiso para subir la imagen. Revisá las reglas de Storage y que el email sea el mismo que en Firestore.";
    }
    if (c.startsWith("auth/")) {
      return `Firebase Auth (${c}): revisá consola del navegador o que .env.local apunte al proyecto correcto.`;
    }
  }
  return "Algo salió mal. Abrí las herramientas de desarrollo (F12) → pestaña Consola y buscá el error en rojo.";
}

export function AdminCatalogoPanel({
  open,
  onClose,
  categoriasProducto,
  onCatalogoActualizado,
}: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [categoria, setCategoria] = useState(categoriasProducto[0] ?? "");
  const [modoImagen, setModoImagen] = useState<"url" | "archivo">("url");
  const [imageUrl, setImageUrl] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

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
    if (open && categoriasProducto.length && !categoriasProducto.includes(categoria)) {
      setCategoria(categoriasProducto[0]);
    }
  }, [open, categoriasProducto, categoria]);

  useEffect(() => {
    if (!open) {
      setAuthError(null);
      setFormError(null);
      setFormOk(null);
    }
  }, [open]);

  if (!open) return null;

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(getFirebaseAuth(), email.trim(), password);
      setPassword("");
    } catch (err) {
      console.error("Login Firebase Auth:", err);
      setAuthError(mensajeFirebase(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(getFirebaseAuth());
  };

  const handleSubmitProducto = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormOk(null);

    const precioNum = Number(String(precio).replace(",", "."));
    if (!nombre.trim()) {
      setFormError("Completá el nombre del producto.");
      return;
    }
    if (!Number.isFinite(precioNum) || precioNum < 0) {
      setFormError("Precio inválido.");
      return;
    }
    if (!categoria) {
      setFormError("Elegí una categoría.");
      return;
    }

    let urlFinal: string;
    if (modoImagen === "url") {
      const u = imageUrl.trim();
      if (!u) {
        setFormError("Pegá el enlace de la imagen (debe empezar con https://).");
        return;
      }
      if (!esUrlImagenValida(u)) {
        setFormError("La URL no es válida. Usá un enlace que empiece con https:// (o http://).");
        return;
      }
      urlFinal = u;
    } else {
      if (!archivo) {
        setFormError("Elegí una foto del producto o cambiá a «Enlace de imagen».");
        return;
      }
      if (archivo.size > MAX_IMAGE_BYTES) {
        setFormError("La imagen es muy grande (máx. 5 MB).");
        return;
      }
      urlFinal = "";
    }

    setGuardando(true);
    try {
      let imageField = urlFinal;
      if (modoImagen === "archivo") {
        const ext = archivo!.name.includes(".")
          ? archivo!.name.slice(archivo!.name.lastIndexOf("."))
          : "";
        const safe = archivo!.name
          .replace(/[^\w.\-]+/g, "_")
          .slice(0, 80);
        const path = `productos/${Date.now()}_${safe || "foto"}${ext}`;
        const storageRef = ref(getFirebaseStorage(), path);
        await uploadBytes(storageRef, archivo!, {
          contentType: archivo!.type || "image/jpeg",
        });
        imageField = await getDownloadURL(storageRef);
      }

      await addDoc(collection(getDb(), "productos"), {
        name: nombre.trim(),
        description: descripcion.trim() || null,
        price: precioNum,
        image: imageField,
        category: categoria,
      });

      setNombre("");
      setDescripcion("");
      setPrecio("");
      setImageUrl("");
      setArchivo(null);
      setFormOk("Producto publicado. Ya aparece en el catálogo.");
      onCatalogoActualizado();
    } catch (err) {
      setFormError(mensajeFirebase(err));
      console.error(err);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-catalogo-title"
    >
      <div
        className="bg-[#fefdfb] rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col border-2 border-[#2F3E46]/15"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex justify-between items-center p-5 border-b border-[#2F3E46]/10">
          <h2 id="admin-catalogo-title" className="text-lg font-heading font-bold uppercase tracking-wide text-[#2F3E46]">
            Agregar producto
          </h2>
          <button
            type="button"
            className="w-9 h-9 rounded-full bg-[#F2EBD3] hover:bg-[#e8e0c8] flex items-center justify-center text-[#2F3E46]"
            onClick={onClose}
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 space-y-4 text-sm text-[#2F3E46]">
          {!authReady ? (
            <p className="text-gray-500 italic">Preparando acceso…</p>
          ) : !user ? (
            <form onSubmit={handleLogin} className="space-y-3">
              <p className="text-gray-600 text-xs leading-relaxed">
                Iniciá sesión con el usuario de Firebase Authentication (mismo email que en las reglas de Firestore). Si usás fotos por enlace, no hace falta Storage.
              </p>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-[#53634B]">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-[#2F3E46]/15 px-3 py-2 outline-none focus:border-[#53634B]"
                  required
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wider text-[#53634B]">Contraseña</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border-2 border-[#2F3E46]/15 px-3 py-2 outline-none focus:border-[#53634B]"
                  required
                />
              </label>
              {authError && <p className="text-red-600 text-xs">{authError}</p>}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full bg-[#53634B] text-white py-3 rounded-xl font-bold hover:bg-[#3d4a38] disabled:opacity-60"
              >
                {authLoading ? "Entrando…" : "Entrar"}
              </button>
            </form>
          ) : (
            <>
              <div className="flex justify-between items-center gap-2 text-xs">
                <span className="truncate text-gray-600">{user.email}</span>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="shrink-0 text-[#A65D37] font-bold hover:underline"
                >
                  Salir
                </button>
              </div>

              <form onSubmit={handleSubmitProducto} className="space-y-3 pt-1">
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#53634B]">Nombre</span>
                  <input
                    type="text"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    className="mt-1 w-full rounded-xl border-2 border-[#2F3E46]/15 px-3 py-2 outline-none focus:border-[#53634B]"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#53634B]">Descripción (opcional)</span>
                  <textarea
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-xl border-2 border-[#2F3E46]/15 px-3 py-2 outline-none focus:border-[#53634B] resize-y min-h-[4rem]"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#53634B]">Precio (ARS)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={precio}
                    onChange={(e) => setPrecio(e.target.value)}
                    placeholder="ej. 125000"
                    className="mt-1 w-full rounded-xl border-2 border-[#2F3E46]/15 px-3 py-2 outline-none focus:border-[#53634B]"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#53634B]">Categoría</span>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    className="mt-1 w-full rounded-xl border-2 border-[#2F3E46]/15 px-3 py-2 outline-none focus:border-[#53634B] bg-white"
                  >
                    {categoriasProducto.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                <fieldset className="space-y-2 rounded-xl border-2 border-[#2F3E46]/10 p-3">
                  <legend className="px-1 text-xs font-bold uppercase tracking-wider text-[#53634B]">
                    Imagen del producto
                  </legend>
                  <div className="flex flex-col gap-2 text-xs">
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="radio"
                        name="modo-imagen"
                        checked={modoImagen === "url"}
                        onChange={() => setModoImagen("url")}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-semibold text-[#2F3E46]">Enlace público (sin Firebase Storage)</span>
                        <span className="block text-gray-500 font-normal">
                          Subí la foto a ImgBB, Imgur, tu web, etc. y pegá la URL directa al archivo (.jpg, .png…).
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="radio"
                        name="modo-imagen"
                        checked={modoImagen === "archivo"}
                        onChange={() => setModoImagen("archivo")}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-semibold text-[#2F3E46]">Subir archivo</span>
                        <span className="block text-gray-500 font-normal">
                          Requiere Firebase Storage (plan Blaze o proyecto con Storage activo). Máx. 5 MB.
                        </span>
                      </span>
                    </label>
                  </div>
                  {modoImagen === "url" ? (
                    <label className="block pt-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#53634B]">URL de la imagen</span>
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://i.ibb.co/....jpg"
                        className="mt-1 w-full rounded-xl border-2 border-[#2F3E46]/15 px-3 py-2 outline-none focus:border-[#53634B] text-xs"
                        autoComplete="off"
                      />
                    </label>
                  ) : (
                    <label className="block pt-1">
                      <span className="text-xs font-bold uppercase tracking-wider text-[#53634B]">Archivo (máx. 5 MB)</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                        className="mt-1 w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-[#F2EBD3] file:px-3 file:py-2 file:font-bold"
                      />
                    </label>
                  )}
                </fieldset>

                {formError && <p className="text-red-600 text-xs">{formError}</p>}
                {formOk && <p className="text-[#53634B] text-xs font-medium">{formOk}</p>}

                <button
                  type="submit"
                  disabled={guardando}
                  className="w-full bg-[#A65D37] text-white py-3 rounded-xl font-bold hover:opacity-95 disabled:opacity-60 font-heading uppercase tracking-wide text-xs"
                >
                  {guardando
                    ? modoImagen === "archivo"
                      ? "Subiendo…"
                      : "Guardando…"
                    : "Publicar en el catálogo"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
