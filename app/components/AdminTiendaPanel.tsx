"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  collection,
  addDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { FirebaseError } from "firebase/app";
import { getDb, getFirebaseAuth, getFirebaseStorage } from "../firebase/config";
import {
  CONFIG_COLLECTION,
  CONFIG_SITE_DOC_ID,
  TEXTO_LED_DEFAULT,
} from "../lib/site-config";
import { CATALOG_ADMIN_EMAIL, esCatalogAdminEmail } from "../lib/catalog-admin";
import type { Pedido, PedidoEstado, PedidoLineItem, Product } from "../types";
import {
  docDataAPedido,
  etiquetaEstadoPedido,
  itemsPedidoDifieren,
  pedidoClienteConfirmoNoVistoPorAdmin,
  PEDIDO_ESTADOS,
} from "../lib/pedidos";
import {
  construirMensajeWhatsAppPedidoCliente,
  normalizarTelefonoWa,
  urlWhatsAppParaNumero,
} from "../lib/whatsapp";
import {
  actualizarInventarioPorCambioDeItemsPedido,
  cambiarEstadoPedidoConInventario,
  estadoComprometeStock,
} from "../lib/pedido-inventario";
import {
  calcularResumenPedidos,
  calcularResumenStock,
} from "../lib/admin-resumen";

type Tab = "portada" | "categorias" | "catalogo" | "resumen" | "pedidos";

type Props = {
  open: boolean;
  onClose: () => void;
  categoriasProducto: string[];
  productos: Product[];
  marqueeText: string;
  onCatalogoActualizado: () => void;
  onSiteConfigActualizado: () => Promise<void>;
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Sin esto en true, no ofrecemos subida a Storage (evita cuelgues si el proyecto no tiene Storage). */
const STORAGE_UPLOAD_HABILITADO =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_UPLOAD === "true";

const STORAGE_UPLOAD_TIMEOUT_MS = 45_000;

function conTimeout<T>(promesa: Promise<T>, ms: number, etiqueta: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`Timeout: ${etiqueta}`)),
      ms
    );
    promesa
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

function esUrlImagenValida(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function mensajeFirebase(error: unknown): string {
  if (error instanceof FirebaseError) {
    const c = error.code;
    if (c === "auth/invalid-credential" || c === "auth/wrong-password") {
      return "Email o contraseña incorrectos.";
    }
    if (c === "auth/user-not-found") {
      return "No hay usuario con ese email en Authentication.";
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
      return "Permisos denegados. Revisá reglas de Firestore y tu email admin.";
    }
    if (c === "storage/unauthorized") {
      return "Storage no autorizado. Revisá reglas de Storage o usá imagen por URL.";
    }
    if (c === "storage/bucket-not-found" || c === "storage/invalid-default-bucket") {
      return "No hay bucket de Storage en este proyecto. Activá Storage en Firebase o usá URL de imagen.";
    }
    if (c.startsWith("storage/")) {
      return "Error de Storage. ¿Tenés Storage activo (plan Blaze)? Si no, usá «Enlace público».";
    }
    if (c.startsWith("auth/")) {
      return `Auth (${c}).`;
    }
  }
  if (error instanceof Error && error.message.startsWith("Timeout:")) {
    return "Storage no respondió a tiempo. Si no tenés Storage en Firebase, usá «Enlace público» (ImgBB) y pegá la URL.";
  }
  return "Error. Revisá la consola (F12).";
}

export function AdminTiendaPanel({
  open,
  onClose,
  categoriasProducto,
  productos,
  marqueeText,
  onCatalogoActualizado,
  onSiteConfigActualizado,
}: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [tab, setTab] = useState<Tab>("portada");
  const [catalogoVista, setCatalogoVista] = useState<"lista" | "form">("lista");
  const [editando, setEditando] = useState<Product | null>(null);

  const [ledDraft, setLedDraft] = useState("");
  const [catsDraft, setCatsDraft] = useState<string[]>([]);
  const [nuevaCat, setNuevaCat] = useState("");
  const [savingSite, setSavingSite] = useState(false);
  const [siteMsg, setSiteMsg] = useState<string | null>(null);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [categoria, setCategoria] = useState("");
  const [modoImagen, setModoImagen] = useState<"url" | "archivo">("url");
  const [imageUrl, setImageUrl] = useState("");
  const [archivo, setArchivo] = useState<File | null>(null);
  /** Vacío = sin tope de stock en la web; "0" = sin venta. */
  const [stockDraft, setStockDraft] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);
  const [borrandoId, setBorrandoId] = useState<string | null>(null);

  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargandoPedidos, setCargandoPedidos] = useState(false);
  const [pedidoMsg, setPedidoMsg] = useState<string | null>(null);
  const [actualizandoPedidoId, setActualizandoPedidoId] = useState<string | null>(
    null
  );
  /** Pedidos sin clientPhone en Firestore (viejos): el admin completa acá. */
  const [waTelManual, setWaTelManual] = useState<Record<string, string>>({});
  /** Marca el mensaje como “pedido actualizado” al avisar por WhatsApp. */
  const [waPedidoModificado, setWaPedidoModificado] = useState<
    Record<string, boolean>
  >({});
  /** Edición de ítems del pedido (cantidades / líneas) antes de guardar en Firestore. */
  const [pedidoItemsEdit, setPedidoItemsEdit] = useState<{
    pedidoId: string;
    items: PedidoLineItem[];
  } | null>(null);
  const [productoParaAgregarPedido, setProductoParaAgregarPedido] = useState("");
  const [guardandoItemsPedidoId, setGuardandoItemsPedidoId] = useState<
    string | null
  >(null);
  const [marcandoVistaConfirmacionId, setMarcandoVistaConfirmacionId] = useState<
    string | null
  >(null);

  const cargarPedidosAdmin = useCallback(async () => {
    setPedidoMsg(null);
    setCargandoPedidos(true);
    try {
      const q = query(
        collection(getDb(), "pedidos"),
        orderBy("createdAt", "desc"),
        limit(100)
      );
      const snap = await getDocs(q);
      const list: Pedido[] = [];
      snap.forEach((d) => {
        const p = docDataAPedido(d.id, d.data() as Record<string, unknown>);
        if (p) list.push(p);
      });
      setPedidos(list);
    } catch (err) {
      console.error(err);
      setPedidoMsg(mensajeFirebase(err));
      setPedidos([]);
    } finally {
      setCargandoPedidos(false);
    }
  }, []);

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
    if (open && user && esCatalogAdminEmail(user.email)) {
      setLedDraft(marqueeText ?? "");
      setCatsDraft(
        categoriasProducto.length ? [...categoriasProducto] : []
      );
    }
  }, [open, user, marqueeText, categoriasProducto]);

  useEffect(() => {
    if (!STORAGE_UPLOAD_HABILITADO && modoImagen === "archivo") {
      setModoImagen("url");
      setArchivo(null);
    }
  }, [modoImagen, open]);

  useEffect(() => {
    if (!open || catalogoVista !== "form") return;
    if (categoriasProducto.length === 0) return;
    if (!categoriasProducto.includes(categoria)) {
      setCategoria(categoriasProducto[0] ?? "");
    }
  }, [open, catalogoVista, categoriasProducto, categoria]);

  useEffect(() => {
    if (open && user && esCatalogAdminEmail(user.email)) {
      void cargarPedidosAdmin();
    }
  }, [open, user, cargarPedidosAdmin]);

  useEffect(() => {
    if (!open) {
      setAuthError(null);
      setFormError(null);
      setFormOk(null);
      setSiteMsg(null);
      setPedidoMsg(null);
      setTab("portada");
      setCatalogoVista("lista");
      setEditando(null);
      setPedidos([]);
      setPedidoItemsEdit(null);
      setProductoParaAgregarPedido("");
      setGuardandoItemsPedidoId(null);
    }
  }, [open]);

  if (!open) return null;

  const notifPedidosClienteConfirmo = pedidos.filter(
    pedidoClienteConfirmoNoVistoPorAdmin
  ).length;

  const resumenPedidos = calcularResumenPedidos(pedidos);
  const resumenStock = calcularResumenStock(productos);

  const categoriaSelectValue = categoriasProducto.includes(categoria)
    ? categoria
    : (categoriasProducto[0] ?? "");

  const resetFormProducto = () => {
    setNombre("");
    setDescripcion("");
    setPrecio("");
    setStockDraft("");
    setCategoria(categoriasProducto[0] ?? "");
    setModoImagen("url");
    setImageUrl("");
    setArchivo(null);
    setEditando(null);
    setFormError(null);
    setFormOk(null);
  };

  const abrirNuevo = () => {
    resetFormProducto();
    setCategoria(categoriasProducto[0] ?? "");
    setCatalogoVista("form");
  };

  const abrirEditar = (p: Product) => {
    setEditando(p);
    setNombre(p.name);
    setDescripcion(p.description ?? "");
    setPrecio(String(p.price ?? ""));
    setStockDraft(
      typeof p.stock === "number" ? String(p.stock) : ""
    );
    setCategoria(p.category ?? categoriasProducto[0] ?? "");
    setModoImagen("url");
    setImageUrl(p.image ?? "");
    setArchivo(null);
    setFormError(null);
    setFormOk(null);
    setCatalogoVista("form");
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(
        getFirebaseAuth(),
        email.trim(),
        password
      );
      setPassword("");
    } catch (err) {
      console.error(err);
      setAuthError(mensajeFirebase(err));
    } finally {
      setAuthLoading(false);
    }
  };

  const guardarPortada = async () => {
    setSiteMsg(null);
    setSavingSite(true);
    try {
      const refSite = doc(getDb(), CONFIG_COLLECTION, CONFIG_SITE_DOC_ID);
      await setDoc(
        refSite,
        { marqueeText: ledDraft.trim() || TEXTO_LED_DEFAULT },
        { merge: true }
      );
      setSiteMsg("Texto del LED guardado.");
      await onSiteConfigActualizado();
    } catch (err) {
      setSiteMsg(mensajeFirebase(err));
    } finally {
      setSavingSite(false);
    }
  };

  const guardarCategorias = async () => {
    setSiteMsg(null);
    const limpias = catsDraft
      .map((c) => c.trim())
      .filter(Boolean)
      .filter((c, i, a) => a.indexOf(c) === i);
    if (limpias.length === 0) {
      setSiteMsg("Dejá al menos una categoría.");
      return;
    }
    if (limpias.some((c) => c.toLowerCase() === "todos")) {
      setSiteMsg('No uses la palabra "Todos" como categoría de producto.');
      return;
    }
    setSavingSite(true);
    try {
      const refSite = doc(getDb(), CONFIG_COLLECTION, CONFIG_SITE_DOC_ID);
      await setDoc(refSite, { categorias: limpias }, { merge: true });
      setCatsDraft(limpias);
      setSiteMsg("Categorías guardadas.");
      await onSiteConfigActualizado();
    } catch (err) {
      setSiteMsg(mensajeFirebase(err));
    } finally {
      setSavingSite(false);
    }
  };

  const handleSubmitProducto = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormOk(null);

    const precioNum = Number(String(precio).replace(",", "."));
    if (!nombre.trim()) {
      setFormError("Completá el nombre.");
      return;
    }
    if (!Number.isFinite(precioNum) || precioNum < 0) {
      setFormError("Precio inválido.");
      return;
    }
    if (!categoriaSelectValue) {
      setFormError("Elegí categoría (guardá categorías en la pestaña correspondiente si falta).");
      return;
    }
    const stockTrim = stockDraft.trim();
    let stockValor: number | undefined | ReturnType<typeof deleteField>;
    if (stockTrim === "") {
      stockValor = editando ? deleteField() : undefined;
    } else {
      const n = Number(String(stockTrim).replace(",", "."));
      if (!Number.isFinite(n) || n < 0 || Math.floor(n) !== n) {
        setFormError("Stock: usá un número entero ≥ 0 o dejalo vacío.");
        return;
      }
      stockValor = n;
    }
    if (modoImagen === "archivo" && !STORAGE_UPLOAD_HABILITADO) {
      setFormError(
        "Subir archivo requiere Firebase Storage. Usá «Enlace público»: subí la foto a ImgBB y pegá la URL, o activá Storage y NEXT_PUBLIC_FIREBASE_STORAGE_UPLOAD=true."
      );
      return;
    }

    setGuardando(true);
    try {
      let imageField: string;
      const subirABucket = async (file: File) => {
        if (file.size > MAX_IMAGE_BYTES) {
          throw new Error("MAX_IMAGE");
        }
        const ext = file.name.includes(".")
          ? file.name.slice(file.name.lastIndexOf("."))
          : "";
        const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
        const path = `productos/${Date.now()}_${safe || "foto"}${ext}`;
        const storageRef = ref(getFirebaseStorage(), path);
        await conTimeout(
          uploadBytes(storageRef, file, {
            contentType: file.type || "image/jpeg",
          }),
          STORAGE_UPLOAD_TIMEOUT_MS,
          "subida a Storage"
        );
        return conTimeout(
          getDownloadURL(storageRef),
          STORAGE_UPLOAD_TIMEOUT_MS,
          "URL de Storage"
        );
      };

      if (editando) {
        const baseImg = editando.image ?? "";
        if (modoImagen === "url") {
          const u = imageUrl.trim();
          imageField = u && esUrlImagenValida(u) ? u : baseImg;
          if (!imageField) {
            setFormError("Pegá una URL de imagen o subí un archivo.");
            return;
          }
        } else if (archivo) {
          imageField = await subirABucket(archivo);
        } else {
          imageField = baseImg;
          if (!imageField) {
            setFormError("Subí una imagen o usá enlace.");
            return;
          }
        }
      } else if (modoImagen === "url") {
        const u = imageUrl.trim();
        if (!u || !esUrlImagenValida(u)) {
          setFormError("Pegá una URL https válida.");
          return;
        }
        imageField = u;
      } else {
        if (!archivo) {
          setFormError("Elegí un archivo o usá enlace.");
          return;
        }
        imageField = await subirABucket(archivo);
      }

      const payload: Record<string, unknown> = {
        name: nombre.trim(),
        description: descripcion.trim() || null,
        price: precioNum,
        image: imageField,
        category: categoriaSelectValue,
      };
      if (stockValor !== undefined) {
        payload.stock = stockValor;
      }
      if (editando) {
        await updateDoc(doc(getDb(), "productos", editando.id), payload);
        setFormOk("Producto actualizado.");
      } else {
        await addDoc(collection(getDb(), "productos"), payload);
        setFormOk("Producto publicado.");
      }
      resetFormProducto();
      setCatalogoVista("lista");
      onCatalogoActualizado();
    } catch (err) {
      if (err instanceof Error && err.message === "MAX_IMAGE") {
        setFormError("Imagen muy grande (máx. 5 MB).");
      } else {
        setFormError(mensajeFirebase(err));
      }
      console.error(err);
    } finally {
      setGuardando(false);
    }
  };

  const eliminarProducto = async (p: Product) => {
    if (!confirm(`¿Eliminar «${p.name}» del catálogo?`)) return;
    setBorrandoId(p.id);
    try {
      await deleteDoc(doc(getDb(), "productos", p.id));
      onCatalogoActualizado();
    } catch (err) {
      alert(mensajeFirebase(err));
    } finally {
      setBorrandoId(null);
    }
  };

  const abrirWhatsAppAlCliente = (p: Pedido) => {
    const manual = waTelManual[p.id]?.trim() ?? "";
    const digitos =
      p.clientPhone && /^[0-9]{10,15}$/.test(p.clientPhone)
        ? p.clientPhone
        : normalizarTelefonoWa(manual);
    if (!digitos) {
      setPedidoMsg(
        "No hay un WhatsApp válido. Si el pedido es viejo, ingresá el número del cliente arriba del botón."
      );
      return;
    }
    setPedidoMsg(null);
    const mensaje = construirMensajeWhatsAppPedidoCliente({
      pedidoId: p.id,
      items: p.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      total: p.total,
      pedidoActualizado: waPedidoModificado[p.id] === true,
    });
    window.open(
      urlWhatsAppParaNumero(digitos, mensaje),
      "_blank",
      "noopener,noreferrer"
    );
  };

  const marcarConfirmacionClienteVista = async (pedidoId: string) => {
    setMarcandoVistaConfirmacionId(pedidoId);
    setPedidoMsg(null);
    try {
      await updateDoc(doc(getDb(), "pedidos", pedidoId), {
        confirmacionClienteVistaPorAdmin: true,
        updatedAt: serverTimestamp(),
      });
      setPedidos((prev) =>
        prev.map((p) =>
          p.id === pedidoId
            ? {
                ...p,
                confirmacionClienteVistaPorAdmin: true,
                updatedAt: new Date(),
              }
            : p
        )
      );
    } catch (err) {
      setPedidoMsg(mensajeFirebase(err));
    } finally {
      setMarcandoVistaConfirmacionId(null);
    }
  };

  const cambiarEstadoPedido = async (pedidoId: string, status: PedidoEstado) => {
    const pedidoRef = pedidos.find((x) => x.id === pedidoId);
    if (
      pedidoRef?.confirmacionModificacion === "pendiente" &&
      estadoComprometeStock(status)
    ) {
      setPedidoMsg(
        "Este pedido tiene cambios que el cliente debe confirmar en «Mi cuenta». No podés ponerlo en preparación ni enviarlo hasta que acepte o rechace (o hasta que reviertas los ítems a lo original)."
      );
      return;
    }
    setActualizandoPedidoId(pedidoId);
    setPedidoMsg(null);
    try {
      const res = await cambiarEstadoPedidoConInventario(pedidoId, status);
      if (!res.ok) {
        setPedidoMsg(res.mensaje);
        return;
      }
      setPedidos((prev) =>
        prev.map((p) =>
          p.id === pedidoId
            ? {
                ...p,
                status,
                stockCommitted: res.nuevoStockCommitted,
                updatedAt: new Date(),
              }
            : p
        )
      );
      onCatalogoActualizado();
      setPedidoMsg("Estado actualizado.");
    } catch (err) {
      setPedidoMsg(mensajeFirebase(err));
    } finally {
      setActualizandoPedidoId(null);
    }
  };

  const recalcLineItem = (line: PedidoLineItem): PedidoLineItem => ({
    ...line,
    lineTotal: line.unitPrice * line.quantity,
  });

  const abrirEdicionItemsPedido = (p: Pedido) => {
    setPedidoMsg(null);
    setProductoParaAgregarPedido("");
    setPedidoItemsEdit({
      pedidoId: p.id,
      items: p.items.map((i) => recalcLineItem({ ...i })),
    });
  };

  const cerrarEdicionItemsPedido = () => {
    setPedidoItemsEdit(null);
    setProductoParaAgregarPedido("");
  };

  const actualizarCantidadItemPedido = (index: number, raw: string) => {
    const n = parseInt(raw, 10);
    if (!pedidoItemsEdit) return;
    if (Number.isNaN(n) || n < 1) return;
    setPedidoItemsEdit((prev) => {
      if (!prev) return prev;
      const items = [...prev.items];
      items[index] = recalcLineItem({ ...items[index], quantity: n });
      return { ...prev, items };
    });
  };

  const quitarItemPedido = (index: number) => {
    setPedidoItemsEdit((prev) => {
      if (!prev) return prev;
      const items = prev.items.filter((_, i) => i !== index);
      return { ...prev, items };
    });
  };

  const agregarProductoAlPedidoEnEdicion = (producto: Product) => {
    setPedidoItemsEdit((prev) => {
      if (!prev) return prev;
      const idx = prev.items.findIndex((l) => l.productId === producto.id);
      let items: PedidoLineItem[];
      if (idx >= 0) {
        items = [...prev.items];
        items[idx] = recalcLineItem({
          ...items[idx],
          quantity: items[idx].quantity + 1,
        });
      } else {
        items = [
          ...prev.items,
          recalcLineItem({
            productId: producto.id,
            name: producto.name,
            quantity: 1,
            unitPrice: producto.price,
            lineTotal: producto.price,
          }),
        ];
      }
      return { ...prev, items };
    });
  };

  const guardarItemsPedidoFirestore = async () => {
    if (!pedidoItemsEdit) return;
    const { pedidoId, items } = pedidoItemsEdit;
    if (items.length === 0) {
      setPedidoMsg("El pedido tiene que tener al menos un producto.");
      return;
    }
    const pedidoActual = pedidos.find((p) => p.id === pedidoId);
    if (!pedidoActual) {
      setPedidoMsg("No se encontró el pedido.");
      return;
    }
    const itemsNorm = items.map((i) => recalcLineItem(i));
    const total = itemsNorm.reduce((s, i) => s + i.lineTotal, 0);
    const hayCambioReal = itemsPedidoDifieren(pedidoActual.items, itemsNorm);
    setGuardandoItemsPedidoId(pedidoId);
    setPedidoMsg(null);
    try {
      if (pedidoActual.stockCommitted) {
        await actualizarInventarioPorCambioDeItemsPedido({
          pedidoId,
          itemsAnteriores: pedidoActual.items,
          itemsNuevos: itemsNorm,
          stockCommitted: true,
          marcarConfirmacionPendiente: hayCambioReal,
        });
      } else {
        await updateDoc(doc(getDb(), "pedidos", pedidoId), {
          items: itemsNorm,
          total,
          updatedAt: serverTimestamp(),
          ...(hayCambioReal ? { confirmacionModificacion: "pendiente" } : {}),
        });
      }
      setPedidos((prev) =>
        prev.map((p) =>
          p.id === pedidoId
            ? {
                ...p,
                items: itemsNorm,
                total,
                updatedAt: new Date(),
                confirmacionModificacion: hayCambioReal
                  ? "pendiente"
                  : p.confirmacionModificacion,
              }
            : p
        )
      );
      onCatalogoActualizado();
      cerrarEdicionItemsPedido();
      setPedidoMsg("Pedido modificado y guardado.");
    } catch (err) {
      setPedidoMsg(mensajeFirebase(err));
    } finally {
      setGuardandoItemsPedidoId(null);
    }
  };

  const inputClass =
    "mt-1.5 w-full rounded-xl border border-[#2F3E46]/12 bg-white px-3.5 py-2.5 text-[#2F3E46] shadow-sm outline-none transition-[box-shadow,border-color] placeholder:text-[#2F3E46]/35 focus:border-[#53634B] focus:ring-2 focus:ring-[#53634B]/20";

  const tabBtn = (t: Tab) =>
    `min-w-0 rounded-xl py-2.5 px-1.5 text-center font-heading text-[10px] font-bold uppercase tracking-wider transition-all sm:px-2 sm:text-xs ${
      tab === t
        ? "bg-[#fefdfb] text-[#2F3E46] shadow-md ring-1 ring-[#2F3E46]/10"
        : "text-[#2F3E46]/65 hover:bg-[#fefdfb]/70 hover:text-[#2F3E46]"
    }`;

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-[#2F3E46]/55 p-3 backdrop-blur-[2px] sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-tienda-title"
    >
      <div
        className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-[#2F3E46]/12 bg-[#F2EBD3]/40 shadow-[0_24px_64px_-16px_rgba(47,62,70,0.45)] backdrop-blur-sm sm:max-w-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <header className="shrink-0 border-b border-white/40 bg-[#2F3E46] px-4 py-4 text-[#F2EBD3] sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e8c9a8]">
                Sangre Nómade
              </p>
              <h2
                id="admin-tienda-title"
                className="font-heading text-lg font-bold uppercase tracking-wide text-white sm:text-xl"
              >
                Administrar tienda
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
              Preparando panel…
            </p>
          ) : !user ? (
            <form
              onSubmit={handleLogin}
              className="mx-auto max-w-sm space-y-5 rounded-2xl border border-[#2F3E46]/10 bg-white p-6 shadow-sm"
            >
              <div className="text-center">
                <p className="font-heading text-xs font-bold uppercase tracking-wider text-[#A65D37]">
                  Acceso administrador
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[#2F3E46]/70">
                  Mismo usuario que en Firebase Authentication y en las reglas de Firestore.
                </p>
              </div>
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
              {authError && (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
                  {authError}
                </p>
              )}
              <button
                type="submit"
                disabled={authLoading}
                className="w-full rounded-xl bg-[#53634B] py-3.5 font-heading text-sm font-bold uppercase tracking-wide text-white shadow-md transition-opacity hover:bg-[#3d4a38] disabled:opacity-55"
              >
                {authLoading ? "Entrando…" : "Entrar"}
              </button>
            </form>
          ) : !esCatalogAdminEmail(user.email) ? (
            <div className="mx-auto max-w-sm space-y-5 rounded-2xl border border-[#2F3E46]/10 bg-white p-6 text-center shadow-sm">
              <p className="font-heading text-xs font-bold uppercase tracking-wider text-[#A65D37]">
                Sin permisos de administración
              </p>
              <p className="text-xs leading-relaxed text-[#2F3E46]/75">
                Iniciaste sesión con <span className="font-medium">{user.email}</span>. Solo la cuenta{" "}
                <code className="rounded bg-[#F2EBD3]/80 px-1 py-0.5 text-[10px]">{CATALOG_ADMIN_EMAIL}</code> puede
                editar la tienda (coincide con las reglas de Firestore).
              </p>
              <button
                type="button"
                onClick={() => signOut(getFirebaseAuth())}
                className="w-full rounded-xl border-2 border-[#2F3E46]/20 py-3 font-heading text-xs font-bold uppercase tracking-wide text-[#2F3E46] transition-colors hover:bg-[#2F3E46]/5"
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#2F3E46]/10 pb-4">
                <span className="max-w-[min(100%,14rem)] truncate rounded-full border border-[#2F3E46]/10 bg-[#F2EBD3]/60 px-3 py-1.5 text-[11px] text-[#2F3E46]/80 sm:max-w-[65%]">
                  {user.email}
                </span>
                <button
                  type="button"
                  onClick={() => signOut(getFirebaseAuth())}
                  className="rounded-full border-2 border-[#A65D37]/40 px-4 py-1.5 font-heading text-[11px] font-bold uppercase tracking-wide text-[#A65D37] transition-colors hover:bg-[#A65D37]/10"
                >
                  Cerrar sesión
                </button>
              </div>

              <nav
                className="mb-5 grid grid-cols-2 gap-1 rounded-2xl border border-[#2F3E46]/10 bg-[#2F3E46]/[0.06] p-1 sm:grid-cols-3 lg:grid-cols-5"
                role="tablist"
                aria-label="Secciones"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "portada"}
                  className={tabBtn("portada")}
                  onClick={() => {
                    setTab("portada");
                    setSiteMsg(null);
                    setPedidoMsg(null);
                  }}
                >
                  Franja LED
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "categorias"}
                  className={tabBtn("categorias")}
                  onClick={() => {
                    setTab("categorias");
                    setSiteMsg(null);
                    setPedidoMsg(null);
                  }}
                >
                  Categorías
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "catalogo"}
                  className={tabBtn("catalogo")}
                  onClick={() => {
                    setTab("catalogo");
                    setSiteMsg(null);
                    setPedidoMsg(null);
                    setCatalogoVista("lista");
                    resetFormProducto();
                  }}
                >
                  Productos
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "resumen"}
                  className={tabBtn("resumen")}
                  onClick={() => {
                    setTab("resumen");
                    setSiteMsg(null);
                    setPedidoMsg(null);
                  }}
                >
                  Resumen
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "pedidos"}
                  className={`relative ${tabBtn("pedidos")}`}
                  onClick={() => {
                    setTab("pedidos");
                    setSiteMsg(null);
                    setPedidoMsg(null);
                  }}
                >
                  <span className="inline-flex items-center justify-center gap-1">
                    Pedidos
                    {notifPedidosClienteConfirmo > 0 && (
                      <span
                        className="inline-flex min-h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-[#A65D37] px-1 font-heading text-[9px] font-bold tabular-nums leading-none text-white sm:text-[10px]"
                        title="Cliente confirmó un pedido modificado"
                      >
                        {notifPedidosClienteConfirmo > 9
                          ? "9+"
                          : notifPedidosClienteConfirmo}
                      </span>
                    )}
                  </span>
                </button>
              </nav>

              {siteMsg && (
                <div
                  className={`mb-4 rounded-xl border px-3 py-2.5 text-xs ${
                    siteMsg.includes("guardad") || siteMsg.includes("Guardad")
                      ? "border-[#53634B]/25 bg-[#53634B]/8 text-[#2F3E46]"
                      : "border-red-200 bg-red-50 text-red-800"
                  }`}
                >
                  {siteMsg}
                </div>
              )}

              {tab === "resumen" && (
                <section className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border border-[#2F3E46]/10 bg-white p-4 shadow-sm sm:p-5">
                    <div>
                      <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-[#2F3E46]">
                        Resumen general
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-[#2F3E46]/65">
                        Números según el catálogo actual y los últimos pedidos cargados en
                        esta sesión (hasta 100). Usá «Actualizar» para refrescar.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        void cargarPedidosAdmin();
                        void onCatalogoActualizado();
                      }}
                      disabled={cargandoPedidos}
                      className="shrink-0 rounded-full border-2 border-[#53634B]/35 bg-[#53634B]/10 px-3 py-2 font-heading text-[10px] font-bold uppercase tracking-wider text-[#2F3E46] transition-colors hover:bg-[#53634B]/18 disabled:opacity-50"
                    >
                      {cargandoPedidos ? "Actualizando…" : "Actualizar"}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-[#53634B]/25 bg-[#53634B]/8 p-4 sm:p-5">
                    <p className="font-heading text-[10px] font-bold uppercase tracking-[0.15em] text-[#53634B]">
                      Inventario (catálogo)
                    </p>
                    <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                      <div className="rounded-xl border border-[#2F3E46]/10 bg-white/90 px-3 py-2">
                        <dt className="text-[#2F3E46]/55">Productos publicados</dt>
                        <dd className="font-heading text-lg font-bold tabular-nums text-[#2F3E46]">
                          {resumenStock.totalProductos}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-[#2F3E46]/10 bg-white/90 px-3 py-2">
                        <dt className="text-[#2F3E46]/55">Unidades con tope (suma)</dt>
                        <dd className="font-heading text-lg font-bold tabular-nums text-[#2F3E46]">
                          {resumenStock.conLimite.unidades.toLocaleString("es-AR")}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-[#2F3E46]/10 bg-white/90 px-3 py-2">
                        <dt className="text-[#2F3E46]/55">Con stock controlado</dt>
                        <dd className="font-semibold text-[#2F3E46]">
                          {resumenStock.conLimite.productos} producto(s)
                        </dd>
                      </div>
                      <div className="rounded-xl border border-[#2F3E46]/10 bg-white/90 px-3 py-2">
                        <dt className="text-[#2F3E46]/55">Sin tope en la web</dt>
                        <dd className="font-semibold text-[#2F3E46]">
                          {resumenStock.sinLimite} producto(s)
                        </dd>
                      </div>
                      <div className="rounded-xl border border-[#A65D37]/30 bg-[#fdf6f0] px-3 py-2 sm:col-span-2">
                        <dt className="text-[#5c3319]/90">Alertas</dt>
                        <dd className="mt-1 text-[#2F3E46]">
                          <span className="font-semibold text-red-800">
                            Sin unidades: {resumenStock.agotados}
                          </span>
                          {" · "}
                          <span className="font-semibold text-[#8b6914]">
                            Stock bajo (1–5 u.): {resumenStock.bajoStock}
                          </span>
                        </dd>
                      </div>
                    </dl>
                    {resumenStock.criticos.length > 0 && (
                      <div className="mt-3">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#53634B]">
                          Prioridad (menos unidades)
                        </p>
                        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-[11px]">
                          {resumenStock.criticos.map((c) => (
                            <li
                              key={c.name}
                              className="flex justify-between gap-2 rounded-lg bg-white/80 px-2 py-1"
                            >
                              <span className="min-w-0 truncate text-[#2F3E46]">{c.name}</span>
                              <span className="shrink-0 font-mono font-semibold tabular-nums text-[#A65D37]">
                                {c.stock}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[#A65D37]/25 bg-gradient-to-br from-[#fefdfb] to-[#F2EBD3]/35 p-4 shadow-sm sm:p-5">
                    <p className="font-heading text-[10px] font-bold uppercase tracking-[0.15em] text-[#A65D37]">
                      Pedidos web
                    </p>
                    <p className="mt-1 text-[11px] text-[#2F3E46]/65">
                      Lista actual: {resumenPedidos.totalEnLista} pedido(s). Suma de totales
                      en pedidos no cancelados:{" "}
                      <strong className="text-[#2F3E46]">
                        ${resumenPedidos.montoPedidosActivos.toLocaleString("es-AR")}
                      </strong>{" "}
                      ({resumenPedidos.cantidadActivos} pedido(s)).
                    </p>
                    <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                      {(
                        [
                          ["recibido", "Recibido"],
                          ["en_preparacion", "En preparación"],
                          ["enviado", "Enviado"],
                          ["entregado", "Entregado"],
                          ["cancelado", "Cancelado"],
                        ] as const
                      ).map(([k, label]) => (
                        <div
                          key={k}
                          className="flex items-center justify-between rounded-lg border border-[#2F3E46]/10 bg-white/90 px-3 py-2"
                        >
                          <dt className="text-[#2F3E46]/75">{label}</dt>
                          <dd className="font-heading font-bold tabular-nums text-[#2F3E46]">
                            {resumenPedidos.porEstado[k]}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-3 space-y-2 rounded-xl border border-[#2F3E46]/10 bg-white/90 px-3 py-2 text-[11px] leading-snug text-[#2F3E46]">
                      <p>
                        <strong className="text-[#8b4510]">Modificación sin confirmar</strong>{" "}
                        (cliente): {resumenPedidos.modificacionPendienteCliente}
                      </p>
                      <p>
                        <strong className="text-[#53634B]">Cliente confirmó</strong> (pendiente
                        de marcar visto): {resumenPedidos.clienteConfirmoSinVista}
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {([7, 30] as const).map((dias) => {
                        const w = resumenPedidos.enVentana(dias);
                        return (
                          <div
                            key={dias}
                            className="rounded-xl border border-[#2F3E46]/10 bg-white/90 px-3 py-2 text-[11px]"
                          >
                            <p className="font-heading text-[10px] font-bold uppercase tracking-wide text-[#53634B]">
                              Últimos {dias} días
                            </p>
                            <p className="mt-1 text-[#2F3E46]">
                              {w.cantidad} pedido(s) creados ·{" "}
                              <span className="font-semibold">
                                ${w.monto.toLocaleString("es-AR")}
                              </span>{" "}
                              total (no cancelados)
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              )}

              {tab === "portada" && (
                <section className="space-y-4 rounded-2xl border border-[#2F3E46]/10 bg-white p-4 shadow-sm sm:p-5">
                  <div>
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-[#2F3E46]">
                      Texto en movimiento
                    </h3>
                    <p className="mt-1 text-xs text-[#2F3E46]/65">
                      Lo que ves en la franja oscura bajo el menú principal.
                    </p>
                  </div>
                  <textarea
                    value={ledDraft}
                    onChange={(e) => setLedDraft(e.target.value)}
                    rows={4}
                    className={`${inputClass} resize-y font-mono text-xs leading-relaxed`}
                    placeholder={TEXTO_LED_DEFAULT}
                  />
                  <button
                    type="button"
                    disabled={savingSite}
                    onClick={guardarPortada}
                    className="w-full rounded-xl bg-[#A65D37] py-3.5 font-heading text-xs font-bold uppercase tracking-wider text-white shadow-md transition-opacity hover:opacity-95 disabled:opacity-50"
                  >
                    {savingSite ? "Guardando…" : "Guardar texto"}
                  </button>
                </section>
              )}

              {tab === "categorias" && (
                <section className="space-y-4 rounded-2xl border border-[#2F3E46]/10 bg-white p-4 shadow-sm sm:p-5">
                  <div>
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-[#2F3E46]">
                      Menú Equipamiento
                    </h3>
                    <p className="mt-1 text-xs text-[#2F3E46]/65">
                      «Todos» se muestra solo en la tienda; acá definís el resto.
                    </p>
                  </div>
                  <ul className="max-h-52 space-y-2 overflow-y-auto pr-1">
                    {catsDraft.map((c, i) => (
                      <li
                        key={`${c}-${i}`}
                        className="flex items-center gap-2 rounded-xl border border-[#2F3E46]/10 bg-[#fefdfb] p-1 shadow-sm"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F2EBD3] text-[11px] font-bold text-[#53634B]">
                          {i + 1}
                        </span>
                        <input
                          value={c}
                          onChange={(e) => {
                            const v = e.target.value;
                            setCatsDraft((prev) =>
                              prev.map((x, j) => (j === i ? v : x))
                            );
                          }}
                          className="min-w-0 flex-1 border-0 bg-transparent px-1 py-2 text-sm outline-none focus:ring-0"
                        />
                        <button
                          type="button"
                          className="shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-red-700 transition-colors hover:bg-red-50"
                          onClick={() =>
                            setCatsDraft((prev) => prev.filter((_, j) => j !== i))
                          }
                          aria-label={`Quitar ${c}`}
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                    <input
                      value={nuevaCat}
                      onChange={(e) => setNuevaCat(e.target.value)}
                      placeholder="Nombre de la nueva categoría"
                      className={inputClass + " sm:mt-0 sm:flex-1"}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          const t = nuevaCat.trim();
                          if (t && !catsDraft.includes(t))
                            setCatsDraft((p) => [...p, t]);
                          setNuevaCat("");
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="shrink-0 rounded-xl bg-[#2F3E46] px-5 py-2.5 font-heading text-xs font-bold uppercase tracking-wide text-white shadow-sm hover:bg-[#243028]"
                      onClick={() => {
                        const t = nuevaCat.trim();
                        if (t && !catsDraft.includes(t))
                          setCatsDraft((p) => [...p, t]);
                        setNuevaCat("");
                      }}
                    >
                      Añadir
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={savingSite}
                    onClick={guardarCategorias}
                    className="w-full rounded-xl border-2 border-[#53634B] bg-[#53634B] py-3.5 font-heading text-xs font-bold uppercase tracking-wider text-white transition-opacity hover:bg-[#3d4a38] disabled:opacity-50"
                  >
                    {savingSite ? "Guardando…" : "Guardar categorías"}
                  </button>
                </section>
              )}

              {tab === "catalogo" && catalogoVista === "lista" && (
                <section className="space-y-4">
                  <button
                    type="button"
                    onClick={abrirNuevo}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#A65D37] py-4 font-heading text-sm font-bold uppercase tracking-wide text-white shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span className="text-lg leading-none">+</span>
                    Nuevo producto
                  </button>
                  <ul className="max-h-[min(52vh,24rem)] space-y-2 overflow-y-auto rounded-2xl border border-[#2F3E46]/10 bg-white p-2 shadow-inner">
                    {productos.length === 0 ? (
                      <li className="py-10 text-center text-sm text-[#2F3E46]/45">
                        Todavía no hay productos en el catálogo.
                      </li>
                    ) : (
                      productos.map((p) => (
                        <li
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-[#2F3E46]/10 hover:bg-[#F2EBD3]/30"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-heading text-sm font-bold text-[#2F3E46]">
                              {p.name}
                            </p>
                            <p className="mt-0.5 text-xs text-[#53634B]">
                              <span className="font-semibold text-[#A65D37]">
                                ${(p.price ?? 0).toLocaleString("es-AR")}
                              </span>
                              <span className="text-[#2F3E46]/40"> · </span>
                              {p.category ?? "—"}
                              {typeof p.stock === "number" && (
                                <>
                                  <span className="text-[#2F3E46]/40"> · </span>
                                  Stock {p.stock}
                                </>
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-[#53634B]/30 bg-[#53634B]/10 px-3 py-2 font-heading text-[11px] font-bold uppercase tracking-wide text-[#2F3E46] transition-colors hover:bg-[#53634B]/20"
                              onClick={() => abrirEditar(p)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={borrandoId === p.id}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-heading text-[11px] font-bold uppercase tracking-wide text-red-800 transition-colors hover:bg-red-100 disabled:opacity-50"
                              onClick={() => eliminarProducto(p)}
                            >
                              {borrandoId === p.id ? "…" : "Borrar"}
                            </button>
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </section>
              )}

              {tab === "catalogo" && catalogoVista === "form" && (
                <form
                  onSubmit={handleSubmitProducto}
                  className="space-y-4 rounded-2xl border border-[#2F3E46]/10 bg-white p-4 shadow-sm sm:p-5"
                >
                  <button
                    type="button"
                    className="group flex items-center gap-2 font-heading text-xs font-bold uppercase tracking-wide text-[#53634B] transition-colors hover:text-[#2F3E46]"
                    onClick={() => {
                      resetFormProducto();
                      setCatalogoVista("lista");
                    }}
                  >
                    <span className="inline-block transition-transform group-hover:-translate-x-0.5">
                      ←
                    </span>
                    Volver al listado
                  </button>
                  <h3 className="border-b border-[#2F3E46]/10 pb-2 font-heading text-base font-bold uppercase tracking-wide text-[#2F3E46]">
                    {editando ? "Editar producto" : "Alta de producto"}
                  </h3>
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#53634B]">
                      Nombre
                    </span>
                    <input
                      type="text"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#53634B]">
                      Descripción{" "}
                      <span className="font-normal normal-case text-[#2F3E46]/45">
                        (opcional)
                      </span>
                    </span>
                    <textarea
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      rows={3}
                      className={`${inputClass} resize-y`}
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#53634B]">
                      Precio (ARS)
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={precio}
                      onChange={(e) => setPrecio(e.target.value)}
                      className={inputClass}
                      required
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#53634B]">
                      Stock (unidades){" "}
                      <span className="font-normal normal-case text-[#2F3E46]/45">
                        (opcional)
                      </span>
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      value={stockDraft}
                      onChange={(e) => setStockDraft(e.target.value)}
                      placeholder="Vacío = sin tope en la web"
                      className={inputClass}
                    />
                    <p className="mt-1 text-[11px] leading-relaxed text-[#2F3E46]/55">
                      0 = sin venta online. Vacío = no mostramos límite (productos viejos o reposición abierta).
                    </p>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#53634B]">
                      Categoría
                    </span>
                    <select
                      value={categoriaSelectValue}
                      onChange={(e) => setCategoria(e.target.value)}
                      disabled={categoriasProducto.length === 0}
                      className={`${inputClass} cursor-pointer disabled:cursor-not-allowed disabled:opacity-55`}
                    >
                      {categoriasProducto.length === 0 ? (
                        <option value="">Primero guardá categorías</option>
                      ) : (
                        categoriasProducto.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))
                      )}
                    </select>
                  </label>

                  <fieldset className="space-y-3 rounded-2xl border border-[#2F3E46]/10 bg-[#F2EBD3]/25 p-4">
                    <legend className="px-1 font-heading text-[11px] font-bold uppercase tracking-wider text-[#2F3E46]">
                      Imagen del producto
                    </legend>
                    <div className="flex flex-col gap-3">
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#2F3E46]/10 bg-white p-3 shadow-sm transition-shadow has-[:checked]:ring-2 has-[:checked]:ring-[#53634B]/30">
                        <input
                          type="radio"
                          name="modo-imagen"
                          checked={modoImagen === "url"}
                          onChange={() => {
                            setModoImagen("url");
                            setArchivo(null);
                          }}
                          className="mt-1 h-4 w-4 accent-[#53634B]"
                        />
                        <span className="text-xs leading-snug text-[#2F3E46]">
                          <span className="font-semibold">URL pública</span>
                          <span className="mt-0.5 block text-[11px] text-[#2F3E46]/60">
                            Pegá el enlace directo a la imagen (.jpg, .png…)
                          </span>
                        </span>
                      </label>
                      {STORAGE_UPLOAD_HABILITADO && (
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#2F3E46]/10 bg-white p-3 shadow-sm transition-shadow has-[:checked]:ring-2 has-[:checked]:ring-[#53634B]/30">
                          <input
                            type="radio"
                            name="modo-imagen"
                            checked={modoImagen === "archivo"}
                            onChange={() => setModoImagen("archivo")}
                            className="mt-1 h-4 w-4 accent-[#53634B]"
                          />
                          <span className="text-xs leading-snug text-[#2F3E46]">
                            <span className="font-semibold">Archivo (Storage)</span>
                            <span className="mt-0.5 block text-[11px] text-[#2F3E46]/60">
                              Subida directa con Firebase Storage
                            </span>
                          </span>
                        </label>
                      )}
                    </div>
                    {modoImagen === "url" ? (
                      <input
                        type="url"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder={
                          editando
                            ? "Misma URL o una nueva"
                            : "https://i.ibb.co/…"
                        }
                        className={inputClass + " font-mono text-xs"}
                      />
                    ) : (
                      STORAGE_UPLOAD_HABILITADO && (
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={(e) =>
                            setArchivo(e.target.files?.[0] ?? null)
                          }
                          className="w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#53634B] file:px-4 file:py-2 file:font-heading file:text-xs file:font-bold file:uppercase file:tracking-wide file:text-white"
                        />
                      )
                    )}
                    {STORAGE_UPLOAD_HABILITADO &&
                      editando &&
                      modoImagen === "archivo" &&
                      !archivo && (
                        <p className="text-[11px] text-[#2F3E46]/55">
                          Sin archivo nuevo se conserva la imagen actual.
                        </p>
                      )}
                  </fieldset>

                  {formError && (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-800">
                      {formError}
                    </p>
                  )}
                  {formOk && (
                    <p className="rounded-xl bg-[#53634B]/10 px-3 py-2 text-xs font-medium text-[#2F3E46]">
                      {formOk}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={guardando}
                    className="w-full rounded-xl bg-[#A65D37] py-3.5 font-heading text-sm font-bold uppercase tracking-wide text-white shadow-md transition-opacity hover:opacity-95 disabled:opacity-50"
                  >
                    {guardando
                      ? "Guardando…"
                      : editando
                        ? "Guardar cambios"
                        : "Publicar producto"}
                  </button>
                </form>
              )}

              {tab === "pedidos" && (
                <section className="space-y-4 rounded-2xl border border-[#2F3E46]/12 bg-gradient-to-br from-[#fefdfb] via-white to-[#F2EBD3]/25 p-4 shadow-[0_12px_40px_-20px_rgba(47,62,70,0.18)] sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#2F3E46]/8 pb-4">
                    <div className="min-w-0">
                      <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.2em] text-[#A65D37]">
                        Tienda
                      </p>
                      <h3 className="mt-0.5 font-heading text-base font-bold uppercase tracking-wide text-[#2F3E46]">
                        Pedidos web
                      </h3>
                      <p className="mt-1 max-w-md text-xs leading-relaxed text-[#2F3E46]/65">
                        Si cambiás ítems o cantidades, el cliente logueado debe confirmar en «Mi cuenta» antes de que puedas poner el pedido en preparación. Sin cuenta, el pedido no queda guardado en el sistema: coordiná el cambio por WhatsApp.
                      </p>
                      <p className="mt-1 max-w-md text-xs leading-relaxed text-[#2F3E46]/55">
                        Cuando el cliente confirma el pedido con cuenta, el stock ya se reserva en el catálogo (otros no pueden comprar esas unidades). Al cancelar o si el cliente rechaza un pedido modificado, el stock vuelve. Pasar a en preparación solo cambia el estado, sin volver a descontar.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void cargarPedidosAdmin()}
                      disabled={cargandoPedidos}
                      className="shrink-0 rounded-full border-2 border-[#53634B]/35 bg-[#53634B]/10 px-4 py-2 font-heading text-[10px] font-bold uppercase tracking-wider text-[#2F3E46] transition-colors hover:bg-[#53634B]/18 disabled:opacity-50"
                    >
                      {cargandoPedidos ? "Cargando…" : "Actualizar lista"}
                    </button>
                  </div>
                  <div className="rounded-2xl border border-[#53634B]/25 bg-[#53634B]/8 px-4 py-3 text-xs leading-relaxed text-[#2F3E46]">
                    <p className="font-heading text-[10px] font-bold uppercase tracking-[0.15em] text-[#53634B]">
                      Rutina sugerida
                    </p>
                    <ol className="mt-2 list-decimal space-y-1.5 pl-4 marker:font-medium">
                      <li>Revisá pedidos nuevos al menos una vez al día.</li>
                      <li>Respondé por WhatsApp y actualizá el estado acá para que el cliente lo vea en «Mi cuenta».</li>
                      <li>El stock con número en Productos se sincroniza con los pedidos al avanzar o cancelar estados; revisá ahí si algo no cierra.</li>
                    </ol>
                  </div>
                  {pedidoMsg && (
                    <div
                      className={`rounded-2xl border px-4 py-3 text-sm leading-snug ${
                        pedidoMsg.toLowerCase().includes("actualiz")
                          ? "border-[#53634B]/25 bg-[#53634B]/10 text-[#2F3E46]"
                          : "border-[#A65D37]/25 bg-[#fdf6f0] text-[#5c3319]"
                      }`}
                      role="alert"
                    >
                      <p className="font-medium">{pedidoMsg}</p>
                      {!pedidoMsg.toLowerCase().includes("actualiz") &&
                        pedidoMsg.toLowerCase().includes("permiso") && (
                          <p className="mt-2 text-xs text-[#2F3E46]/75">
                            En el archivo <code className="rounded bg-white/80 px-1 py-0.5 text-[11px]">firestore.rules</code>, la función{" "}
                            <code className="rounded bg-white/80 px-1 py-0.5 text-[11px]">isCatalogAdmin</code> tiene que usar el mismo email
                            con el que iniciaste sesión. Luego publicá las reglas en Firebase → Firestore → Reglas.
                          </p>
                        )}
                    </div>
                  )}
                  {cargandoPedidos && pedidos.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <div
                        className="h-9 w-9 animate-spin rounded-full border-2 border-[#53634B]/25 border-t-[#53634B]"
                        aria-hidden
                      />
                      <p className="text-sm text-[#2F3E46]/55">Cargando pedidos…</p>
                    </div>
                  ) : pedidos.length === 0 &&
                    !(pedidoMsg && !pedidoMsg.toLowerCase().includes("actualiz")) ? (
                    <div className="rounded-2xl border border-dashed border-[#2F3E46]/15 bg-white/60 py-12 text-center">
                      <p className="text-sm text-[#2F3E46]/55">
                        Todavía no hay pedidos guardados desde la web.
                      </p>
                      <p className="mt-1 text-xs text-[#2F3E46]/40">
                        Aparecen cuando un cliente envía el carrito con sesión iniciada.
                      </p>
                    </div>
                  ) : pedidos.length > 0 ? (
                    <ul className="max-h-[min(52vh,26rem)] space-y-3 overflow-y-auto pr-1">
                      {pedidos.map((p) => (
                        <li
                          key={p.id}
                          className="rounded-xl border border-[#2F3E46]/10 bg-white/90 p-3.5 shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-mono text-[10px] text-[#2F3E46]/55">
                                {p.id}
                              </p>
                              <p className="text-xs font-medium text-[#2F3E46]">
                                {p.userEmail || "—"}
                              </p>
                              <p className="text-[11px] text-[#2F3E46]/50">
                                {p.createdAt
                                  ? p.createdAt.toLocaleString("es-AR", {
                                      dateStyle: "short",
                                      timeStyle: "short",
                                    })
                                  : "—"}
                              </p>
                            </div>
                            <select
                              value={p.status}
                              onChange={(e) =>
                                cambiarEstadoPedido(
                                  p.id,
                                  e.target.value as PedidoEstado
                                )
                              }
                              disabled={actualizandoPedidoId === p.id}
                              className="shrink-0 rounded-lg border border-[#2F3E46]/15 bg-white px-2 py-1.5 text-[11px] font-medium text-[#2F3E46] outline-none focus:ring-2 focus:ring-[#53634B]/25 disabled:opacity-50"
                              aria-label={`Estado del pedido ${p.id}`}
                            >
                              {PEDIDO_ESTADOS.map((s) => (
                                <option key={s} value={s}>
                                  {etiquetaEstadoPedido(s)}
                                </option>
                              ))}
                            </select>
                          </div>
                          {pedidoClienteConfirmoNoVistoPorAdmin(p) && (
                            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-[#53634B]/35 bg-[#eef4ea] px-3 py-2.5">
                              <span
                                className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[#A65D37] px-1.5 font-heading text-[11px] font-bold tabular-nums text-white"
                                title="Nuevo"
                              >
                                1
                              </span>
                              <p className="min-w-0 flex-1 text-[11px] font-semibold leading-snug text-[#2F3E46]">
                                Pedido confirmado: el cliente aceptó la modificación en «Mi
                                cuenta».
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  void marcarConfirmacionClienteVista(p.id)
                                }
                                disabled={marcandoVistaConfirmacionId === p.id}
                                className="shrink-0 rounded-lg border border-[#53634B]/40 bg-white px-3 py-1.5 font-heading text-[10px] font-bold uppercase tracking-wide text-[#53634B] transition-colors hover:bg-[#53634B]/10 disabled:opacity-50"
                              >
                                {marcandoVistaConfirmacionId === p.id
                                  ? "…"
                                  : "Marcar visto"}
                              </button>
                            </div>
                          )}
                          {p.stockCommitted && (
                            <p className="mt-1.5 text-[10px] font-medium text-[#53634B]">
                              Unidades descontadas del stock del catálogo (pedido en curso).
                            </p>
                          )}
                          {pedidoItemsEdit?.pedidoId === p.id ? (
                            <div className="mt-3 space-y-2 rounded-xl border border-[#53634B]/25 bg-[#fefdfb] p-3">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-[#53634B]">
                                Modificar pedido
                              </p>
                              <ul className="space-y-2">
                                {pedidoItemsEdit.items.map((line, idx) => (
                                  <li
                                    key={`${line.productId}-${idx}`}
                                    className="flex flex-wrap items-center gap-2 border-b border-[#2F3E46]/8 pb-2 last:border-0 last:pb-0"
                                  >
                                    <span className="min-w-0 flex-1 text-left text-xs text-[#2F3E46]">
                                      {line.name}
                                    </span>
                                    <label className="flex items-center gap-1.5 text-[11px] text-[#2F3E46]/75">
                                      <span className="whitespace-nowrap">Cant.</span>
                                      <input
                                        type="number"
                                        min={1}
                                        inputMode="numeric"
                                        value={line.quantity}
                                        onChange={(e) =>
                                          actualizarCantidadItemPedido(idx, e.target.value)
                                        }
                                        className="w-16 rounded-lg border border-[#2F3E46]/15 bg-white px-2 py-1 text-center text-xs font-semibold text-[#2F3E46] outline-none focus:ring-2 focus:ring-[#53634B]/25"
                                      />
                                    </label>
                                    <span className="text-xs font-semibold text-[#A65D37]">
                                      ${line.lineTotal.toLocaleString("es-AR")}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => quitarItemPedido(idx)}
                                      disabled={pedidoItemsEdit.items.length <= 1}
                                      className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold uppercase text-red-800 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      Quitar
                                    </button>
                                  </li>
                                ))}
                              </ul>
                              {productos.length > 0 ? (
                                <label className="mt-1 block text-left">
                                  <span className="text-[10px] font-bold uppercase tracking-wide text-[#53634B]">
                                    Agregar del catálogo
                                  </span>
                                  <select
                                    value={productoParaAgregarPedido}
                                    onChange={(e) => {
                                      const id = e.target.value;
                                      setProductoParaAgregarPedido("");
                                      if (!id) return;
                                      const prod = productos.find((x) => x.id === id);
                                      if (prod) agregarProductoAlPedidoEnEdicion(prod);
                                    }}
                                    className={`${inputClass} mt-1 text-xs`}
                                  >
                                    <option value="">Elegir producto…</option>
                                    {productos.map((pr) => (
                                      <option key={pr.id} value={pr.id}>
                                        {pr.name} (${pr.price.toLocaleString("es-AR")})
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : (
                                <p className="text-[11px] text-[#2F3E46]/55">
                                  No hay productos en el catálogo cargados; cargalos en la pestaña Productos para sumar líneas.
                                </p>
                              )}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#2F3E46]/10 pt-2">
                                <p className="font-bold text-[#A65D37]">
                                  Total: $
                                  {pedidoItemsEdit.items
                                    .reduce((s, i) => s + i.lineTotal, 0)
                                    .toLocaleString("es-AR")}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={cerrarEdicionItemsPedido}
                                    disabled={guardandoItemsPedidoId === p.id}
                                    className="rounded-lg border border-[#2F3E46]/20 bg-white px-3 py-2 text-[11px] font-bold uppercase text-[#2F3E46] transition-colors hover:bg-[#2F3E46]/5 disabled:opacity-50"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void guardarItemsPedidoFirestore()}
                                    disabled={
                                      guardandoItemsPedidoId === p.id ||
                                      pedidoItemsEdit.items.length === 0
                                    }
                                    className="rounded-lg bg-[#53634B] px-3 py-2 text-[11px] font-bold uppercase text-white transition-opacity hover:opacity-95 disabled:opacity-50"
                                  >
                                    {guardandoItemsPedidoId === p.id
                                      ? "Guardando…"
                                      : "Guardar cambios"}
                                  </button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="mt-2 text-xs text-[#2F3E46]/75">
                                {p.items
                                  .map((i) => `${i.name} ×${i.quantity}`)
                                  .join(" · ")}
                              </p>
                              <p className="mt-1 font-bold text-[#A65D37]">
                                ${p.total.toLocaleString("es-AR")}
                              </p>
                              <button
                                type="button"
                                onClick={() => abrirEdicionItemsPedido(p)}
                                disabled={
                                  guardandoItemsPedidoId !== null ||
                                  actualizandoPedidoId === p.id
                                }
                                className="mt-2 w-full rounded-lg border-2 border-dashed border-[#53634B]/35 bg-[#53634B]/6 py-2 text-[11px] font-bold uppercase tracking-wide text-[#53634B] transition-colors hover:bg-[#53634B]/12 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Modificar pedido (cantidades / productos)
                              </button>
                            </>
                          )}
                          {p.clientPhone ? (
                            <p className="mt-1.5 text-[11px] text-[#53634B]">
                              WhatsApp cliente:{" "}
                              <span className="font-mono font-semibold">
                                +{p.clientPhone}
                              </span>
                            </p>
                          ) : (
                            <label className="mt-2 block text-left">
                              <span className="text-[10px] font-bold uppercase tracking-wide text-[#A65D37]">
                                WhatsApp del cliente (si el pedido es anterior)
                              </span>
                              <input
                                type="tel"
                                inputMode="tel"
                                value={waTelManual[p.id] ?? ""}
                                onChange={(e) =>
                                  setWaTelManual((prev) => ({
                                    ...prev,
                                    [p.id]: e.target.value,
                                  }))
                                }
                                placeholder="+54 9 351 …"
                                className="mt-1 w-full rounded-lg border border-[#2F3E46]/12 bg-white px-2.5 py-2 text-xs text-[#2F3E46] outline-none focus:ring-2 focus:ring-[#53634B]/25"
                              />
                            </label>
                          )}
                          <label className="mt-2 flex cursor-pointer items-start gap-2 text-left text-[11px] leading-snug text-[#2F3E46]/85">
                            <input
                              type="checkbox"
                              checked={waPedidoModificado[p.id] === true}
                              onChange={(e) =>
                                setWaPedidoModificado((prev) => ({
                                  ...prev,
                                  [p.id]: e.target.checked,
                                }))
                              }
                              className="mt-0.5 h-4 w-4 shrink-0 accent-[#53634B]"
                            />
                            <span>
                              Incluir en el mensaje de WhatsApp que el pedido fue{" "}
                              <strong>modificado o ajustado</strong> y que puede ver el
                              detalle en «Mi cuenta».
                              <span className="mt-1 block text-[10px] font-normal text-[#2F3E46]/65">
                                La confirmación del cliente no está en la web: la coordinás
                                cuando te responde por WhatsApp.
                              </span>
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => abrirWhatsAppAlCliente(p)}
                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-[#25d366]/50 bg-[#25d366]/12 py-2.5 font-heading text-[11px] font-bold uppercase tracking-wide text-[#128C7E] transition-colors hover:bg-[#25d366]/20"
                          >
                            <span aria-hidden>💬</span>
                            Enviar mensaje al cliente por WhatsApp
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
