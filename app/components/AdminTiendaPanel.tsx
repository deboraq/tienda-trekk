"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
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
  construirMensajeWhatsAppPlantilla,
  normalizarTelefonoWa,
  urlWhatsAppParaNumero,
  type PlantillaWaAdmin,
} from "../lib/whatsapp";
import { formatARS } from "../lib/brand";
import { IconCart, IconCreditCard, IconLogout, IconSearch, IconTruck } from "./storefront/Icons";
import { formatTelAR } from "./panels/panel-ui";
import Image from "next/image";
import { ModalModificarPedido } from "./ModalModificarPedido";
import {
  actualizarInventarioPorCambioDeItemsPedido,
  cambiarEstadoPedidoConInventario,
  eliminarPedidoConInventario,
  estadoComprometeStock,
} from "../lib/pedido-inventario";
import {
  calcularKpisAdminDia,
  calcularResumenPedidos,
  calcularResumenStock,
  filtrarPedidosAdmin,
  type FiltroEstadoPedidos,
  type FiltroPeriodoPedidos,
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
  /** Edición de ítems del pedido en el modal. */
  const [pedidoEditando, setPedidoEditando] = useState<Pedido | null>(null);
  const [busquedaPedidos, setBusquedaPedidos] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoPedidos>("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodoPedidos>("todos");
  const [waPlantilla, setWaPlantilla] = useState<Record<string, PlantillaWaAdmin>>({});
  const [eliminandoPedidoId, setEliminandoPedidoId] = useState<string | null>(null);
  const busquedaPedidosRef = useRef<HTMLInputElement>(null);
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
      setPedidoEditando(null);
      setGuardandoItemsPedidoId(null);
      setBusquedaPedidos("");
      setFiltroEstado("todos");
      setFiltroPeriodo("todos");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setTab("pedidos");
        window.setTimeout(() => busquedaPedidosRef.current?.focus(), 0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const kpisDia = calcularKpisAdminDia(pedidos);
  const pedidosFiltrados = filtrarPedidosAdmin(pedidos, {
    busqueda: busquedaPedidos,
    estado: filtroEstado,
    periodo: filtroPeriodo,
  });

  if (!open) return null;

  const notifPedidosClienteConfirmo = pedidos.filter(
    pedidoClienteConfirmoNoVistoPorAdmin
  ).length;
  const nPendientes = pedidos.filter(
    (p) => p.status === "recibido" || p.status === "en_preparacion"
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
    const plantilla = waPlantilla[p.id] ?? (waPedidoModificado[p.id] ? "ajuste_stock" : "preparacion");
    const mensaje = construirMensajeWhatsAppPlantilla({
      plantilla,
      pedidoId: p.id,
      items: p.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      total: p.total,
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

  const guardarItemsPedidoFirestore = async (opts: {
    items: PedidoLineItem[];
    motivo: string;
    notificar: boolean;
  }) => {
    if (!pedidoEditando) return;
    const pedidoId = pedidoEditando.id;
    const items = opts.items;
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
    const marcarPendiente = hayCambioReal && opts.notificar;
    setGuardandoItemsPedidoId(pedidoId);
    setPedidoMsg(null);
    try {
      if (pedidoActual.stockCommitted) {
        await actualizarInventarioPorCambioDeItemsPedido({
          pedidoId,
          itemsAnteriores: pedidoActual.items,
          itemsNuevos: itemsNorm,
          stockCommitted: true,
          marcarConfirmacionPendiente: marcarPendiente,
        });
        if (opts.motivo || marcarPendiente) {
          await updateDoc(doc(getDb(), "pedidos", pedidoId), {
            ...(opts.motivo ? { motivoModificacion: opts.motivo } : {}),
            updatedAt: serverTimestamp(),
          });
        }
      } else {
        await updateDoc(doc(getDb(), "pedidos", pedidoId), {
          items: itemsNorm,
          total,
          updatedAt: serverTimestamp(),
          ...(marcarPendiente ? { confirmacionModificacion: "pendiente" } : {}),
          ...(opts.motivo ? { motivoModificacion: opts.motivo } : {}),
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
                motivoModificacion: opts.motivo,
                confirmacionModificacion: marcarPendiente
                  ? "pendiente"
                  : p.confirmacionModificacion,
              }
            : p
        )
      );
      if (opts.notificar) {
        setWaPedidoModificado((prev) => ({ ...prev, [pedidoId]: true }));
        setWaPlantilla((prev) => ({ ...prev, [pedidoId]: "ajuste_stock" }));
      }
      onCatalogoActualizado();
      setPedidoEditando(null);
      setPedidoMsg(
        marcarPendiente
          ? "Pedido modificado. El cliente tiene que confirmarlo en «Mi cuenta»."
          : "Pedido modificado y guardado."
      );
    } catch (err) {
      setPedidoMsg(mensajeFirebase(err));
    } finally {
      setGuardandoItemsPedidoId(null);
    }
  };

  const eliminarPedido = async (p: Pedido) => {
    if (
      !confirm(
        `¿Eliminar el pedido ${p.id}? Esta acción no se puede deshacer. Si el stock ya estaba descontado, se reincorpora al catálogo.`
      )
    ) {
      return;
    }
    setEliminandoPedidoId(p.id);
    setPedidoMsg(null);
    try {
      const res = await eliminarPedidoConInventario(p.id);
      if (!res.ok) {
        setPedidoMsg(res.mensaje);
        return;
      }
      setPedidos((prev) => prev.filter((x) => x.id !== p.id));
      onCatalogoActualizado();
      setPedidoMsg("Pedido eliminado.");
    } catch (err) {
      setPedidoMsg(mensajeFirebase(err));
    } finally {
      setEliminandoPedidoId(null);
    }
  };

  const exportarPedidosCsv = () => {
    const filas = [
      ["id", "email", "telefono", "estado", "total", "fecha", "items"].join(","),
      ...pedidosFiltrados.map((p) =>
        [
          p.id,
          p.userEmail,
          p.clientPhone ?? "",
          p.status,
          String(p.total),
          p.createdAt?.toISOString() ?? "",
          `"${p.items.map((i) => `${i.name} x${i.quantity}`).join("; ")}"`,
        ].join(",")
      ),
    ];
    const blob = new Blob([filas.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pedidos-sangre-nomade-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputClass =
    "mt-1.5 w-full rounded-lg border border-white/10 bg-[#151311] px-3.5 py-2.5 text-white outline-none placeholder:text-white/30 focus:border-[#E2781E]/50 focus:ring-1 focus:ring-[#E2781E]/30";

  const tabBtn = (t: Tab) =>
    `min-w-0 rounded-lg px-4 py-2 text-center font-heading text-xs font-bold uppercase tracking-wider transition-all ${
      tab === t
        ? "bg-[#E2781E] text-white shadow-md"
        : "text-[#9CA3AF] hover:text-white"
    }`;

  return (
    <div
      className="fixed inset-0 z-[220] overflow-x-hidden overflow-y-auto overscroll-contain bg-[#151311] text-[#F3F4F6]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-tienda-title"
    >
      <header className="sticky top-0 z-10 h-16 border-b border-white/[0.08] bg-[#151311]">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <button type="button" onClick={onClose} className="flex items-center gap-3 text-left">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-white/5">
              <Image
                src="/brand/isotipo-oficial.png"
                alt="Sangre Nómade"
                width={36}
                height={36}
                className="h-8 w-8 object-contain"
                priority
              />
            </span>
            <span>
              <span className="flex items-center gap-2">
                <span className="block font-heading text-xs font-bold uppercase tracking-widest text-[#E2781E]">
                  Sangre Nómade
                </span>
                <span className="hidden rounded-full border border-[#E2781E]/30 bg-[#E2781E]/10 px-2 py-0.5 font-heading text-[9px] font-bold uppercase tracking-wide text-[#E8A882] sm:inline">
                  Tienda oficial
                </span>
              </span>
              <span className="block text-sm font-semibold text-white">Panel de control de comerciante</span>
            </span>
          </button>
          {user && (
            <div className="flex items-center gap-3">
              <span className="hidden text-right sm:block">
                <span className="block font-heading text-[9px] font-bold uppercase tracking-widest text-[#9CA3AF]">
                  Cuenta activa
                </span>
                <span className="text-xs text-[#D1D5DB]">{user.email}</span>
              </span>
              <button
                type="button"
                onClick={() => signOut(getFirebaseAuth())}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 font-heading text-xs uppercase tracking-wide text-[#9CA3AF] transition hover:text-white"
              >
                <IconLogout className="h-3.5 w-3.5" /> Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          {!authReady ? (
            <p className="py-16 text-center text-sm text-[#9CA3AF]">Preparando panel…</p>
          ) : !user ? (
            <form
              onSubmit={handleLogin}
              className="mx-auto max-w-sm space-y-5 rounded-xl border border-white/[0.08] bg-[#1D1B19] p-6"
            >
              <div className="text-center">
                <p className="font-heading text-xs font-bold uppercase tracking-wider text-[#E2781E]">
                  Acceso administrador
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[#9CA3AF]">
                  Mismo usuario que en Firebase Authentication y en las reglas de Firestore.
                </p>
              </div>
              <label className="block">
                <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#E2781E]">Email</span>
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
              </label>
              <label className="block">
                <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#E2781E]">Contraseña</span>
                <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} required />
              </label>
              {authError && <p className="rounded-lg bg-red-950/50 px-3 py-2 text-xs text-red-300">{authError}</p>}
              <button type="submit" disabled={authLoading} className="w-full rounded-lg bg-[#E2781E] py-3.5 font-heading text-sm font-bold uppercase tracking-wide text-black hover:bg-[#C96614] disabled:opacity-55">
                {authLoading ? "Entrando…" : "Entrar"}
              </button>
            </form>
          ) : !esCatalogAdminEmail(user.email) ? (
            <div className="mx-auto max-w-sm space-y-5 rounded-xl border border-white/[0.08] bg-[#1D1B19] p-6 text-center">
              <p className="font-heading text-xs font-bold uppercase tracking-wider text-[#E2781E]">Sin permisos de administración</p>
              <p className="text-xs leading-relaxed text-[#9CA3AF]">
                Iniciaste sesión con <span className="font-medium text-white">{user.email}</span>. Solo la cuenta{" "}
                <code className="rounded bg-[#151311] px-1 py-0.5 text-[10px] text-[#E8A882]">{CATALOG_ADMIN_EMAIL}</code> puede editar la tienda.
              </p>
              <button type="button" onClick={() => signOut(getFirebaseAuth())} className="w-full rounded-lg border border-white/10 py-3 font-heading text-xs font-bold uppercase tracking-wide text-white hover:bg-white/5">
                Cerrar sesión
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="font-heading text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                    Sangre Nómade / Panel de gestión
                  </p>
                  <h1 id="admin-tienda-title" className="mt-1 font-heading text-3xl font-black uppercase tracking-wide text-white">
                    Administrar tienda
                  </h1>
                </div>
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-3 py-1 font-heading text-xs font-bold uppercase tracking-wide text-emerald-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  Tienda online activa
                </span>
              </div>

              <nav
                className="mb-6 flex flex-wrap gap-2 rounded-xl border border-white/5 bg-[#1D1B19] p-1.5"
                role="tablist"
                aria-label="Secciones"
              >
                <button type="button" role="tab" aria-selected={tab === "portada"} className={tabBtn("portada")} onClick={() => { setTab("portada"); setSiteMsg(null); setPedidoMsg(null); }}>
                  Franja de novedades
                </button>
                <button type="button" role="tab" aria-selected={tab === "categorias"} className={tabBtn("categorias")} onClick={() => { setTab("categorias"); setSiteMsg(null); setPedidoMsg(null); }}>
                  Categorías
                </button>
                <button type="button" role="tab" aria-selected={tab === "catalogo"} className={tabBtn("catalogo")} onClick={() => { setTab("catalogo"); setSiteMsg(null); setPedidoMsg(null); setCatalogoVista("lista"); resetFormProducto(); }}>
                  Productos
                </button>
                <button type="button" role="tab" aria-selected={tab === "resumen"} className={tabBtn("resumen")} onClick={() => { setTab("resumen"); setSiteMsg(null); setPedidoMsg(null); }}>
                  Resumen {notifPedidosClienteConfirmo > 0 ? "•" : ""}
                </button>
                <button type="button" role="tab" aria-selected={tab === "pedidos"} className={`inline-flex items-center gap-2 ${tabBtn("pedidos")}`} onClick={() => { setTab("pedidos"); setSiteMsg(null); setPedidoMsg(null); }}>
                  Pedidos
                  {nPendientes > 0 && (
                    <span className={`rounded-full px-2 py-0.5 font-heading text-[10px] font-bold ${tab === "pedidos" ? "bg-black/20 text-white" : "bg-[#E2781E] text-white"}`}>
                      {nPendientes} pendientes
                    </span>
                  )}
                </button>
              </nav>

              {siteMsg && (
                <div
                  className={`mb-4 rounded-xl border px-3 py-2.5 text-xs ${
                    siteMsg.includes("guardad") || siteMsg.includes("Guardad")
                      ? "border-[#E2781E]/25 bg-[#E2781E]/8 text-[#F3F4F6]"
                      : "border-red-500/30 bg-red-950/40 text-red-300"
                  }`}
                >
                  {siteMsg}
                </div>
              )}

              {tab === "resumen" && (
                <section className="space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2 rounded-2xl border border-white/10 bg-[#1D1B19] p-4 shadow-sm sm:p-5">
                    <div>
                      <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-[#F3F4F6]">
                        Resumen general
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-[#F3F4F6]/65">
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
                      className="shrink-0 rounded-full border-2 border-[#E2781E]/35 bg-[#E2781E]/10 px-3 py-2 font-heading text-[10px] font-bold uppercase tracking-wider text-[#F3F4F6] transition-colors hover:bg-[#E2781E]/18 disabled:opacity-50"
                    >
                      {cargandoPedidos ? "Actualizando…" : "Actualizar"}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-[#E2781E]/25 bg-[#E2781E]/8 p-4 sm:p-5">
                    <p className="font-heading text-[10px] font-bold uppercase tracking-[0.15em] text-[#E2781E]">
                      Inventario (catálogo)
                    </p>
                    <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-[#1D1B19] px-3 py-2">
                        <dt className="text-[#F3F4F6]/55">Productos publicados</dt>
                        <dd className="font-heading text-lg font-bold tabular-nums text-[#F3F4F6]">
                          {resumenStock.totalProductos}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#1D1B19] px-3 py-2">
                        <dt className="text-[#F3F4F6]/55">Unidades con tope (suma)</dt>
                        <dd className="font-heading text-lg font-bold tabular-nums text-[#F3F4F6]">
                          {resumenStock.conLimite.unidades.toLocaleString("es-AR")}
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#1D1B19] px-3 py-2">
                        <dt className="text-[#F3F4F6]/55">Con stock controlado</dt>
                        <dd className="font-semibold text-[#F3F4F6]">
                          {resumenStock.conLimite.productos} producto(s)
                        </dd>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-[#1D1B19] px-3 py-2">
                        <dt className="text-[#F3F4F6]/55">Sin tope en la web</dt>
                        <dd className="font-semibold text-[#F3F4F6]">
                          {resumenStock.sinLimite} producto(s)
                        </dd>
                      </div>
                      <div className="rounded-xl border border-[#E2781E]/30 bg-[#1F1B16] px-3 py-2 sm:col-span-2">
                        <dt className="text-[#E8A882]">Alertas</dt>
                        <dd className="mt-1 text-[#F3F4F6]">
                          <span className="font-semibold text-red-300">
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
                        <p className="text-[10px] font-bold uppercase tracking-wide text-[#E2781E]">
                          Prioridad (menos unidades)
                        </p>
                        <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-[11px]">
                          {resumenStock.criticos.map((c) => (
                            <li
                              key={c.name}
                              className="flex justify-between gap-2 rounded-lg bg-[#1D1B19] px-2 py-1"
                            >
                              <span className="min-w-0 truncate text-[#F3F4F6]">{c.name}</span>
                              <span className="shrink-0 font-mono font-semibold tabular-nums text-[#E2781E]">
                                {c.stock}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[#E2781E]/25 bg-gradient-to-br from-[#151311] to-[#1D1B19]/35 p-4 shadow-sm sm:p-5">
                    <p className="font-heading text-[10px] font-bold uppercase tracking-[0.15em] text-[#E2781E]">
                      Pedidos web
                    </p>
                    <p className="mt-1 text-[11px] text-[#F3F4F6]/65">
                      Lista actual: {resumenPedidos.totalEnLista} pedido(s). Suma de totales
                      en pedidos no cancelados:{" "}
                      <strong className="text-[#F3F4F6]">
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
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-[#1D1B19] px-3 py-2"
                        >
                          <dt className="text-[#F3F4F6]/75">{label}</dt>
                          <dd className="font-heading font-bold tabular-nums text-[#F3F4F6]">
                            {resumenPedidos.porEstado[k]}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-[#1D1B19] px-3 py-2 text-[11px] leading-snug text-[#F3F4F6]">
                      <p>
                        <strong className="text-[#E8A882]">Modificación sin confirmar</strong>{" "}
                        (cliente): {resumenPedidos.modificacionPendienteCliente}
                      </p>
                      <p>
                        <strong className="text-[#E2781E]">Cliente confirmó</strong> (pendiente
                        de marcar visto): {resumenPedidos.clienteConfirmoSinVista}
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {([7, 30] as const).map((dias) => {
                        const w = resumenPedidos.enVentana(dias);
                        return (
                          <div
                            key={dias}
                            className="rounded-xl border border-white/10 bg-[#1D1B19] px-3 py-2 text-[11px]"
                          >
                            <p className="font-heading text-[10px] font-bold uppercase tracking-wide text-[#E2781E]">
                              Últimos {dias} días
                            </p>
                            <p className="mt-1 text-[#F3F4F6]">
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
                <section className="space-y-4 rounded-2xl border border-white/10 bg-[#1D1B19] p-4 shadow-sm sm:p-5">
                  <div>
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-[#F3F4F6]">
                      Texto en movimiento
                    </h3>
                    <p className="mt-1 text-xs text-[#F3F4F6]/65">
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
                    className="w-full rounded-xl bg-[#E2781E] py-3.5 font-heading text-xs font-bold uppercase tracking-wider text-white shadow-md transition-opacity hover:opacity-95 disabled:opacity-50"
                  >
                    {savingSite ? "Guardando…" : "Guardar texto"}
                  </button>
                </section>
              )}

              {tab === "categorias" && (
                <section className="space-y-4 rounded-2xl border border-white/10 bg-[#1D1B19] p-4 shadow-sm sm:p-5">
                  <div>
                    <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-[#F3F4F6]">
                      Menú Equipamiento
                    </h3>
                    <p className="mt-1 text-xs text-[#F3F4F6]/65">
                      «Todos» se muestra solo en la tienda; acá definís el resto.
                    </p>
                  </div>
                  <ul className="max-h-52 space-y-2 overflow-y-auto pr-1">
                    {catsDraft.map((c, i) => (
                      <li
                        key={`${c}-${i}`}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#151311] p-1 shadow-sm"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1D1B19] text-[11px] font-bold text-[#E2781E]">
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
                          className="shrink-0 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-red-300 transition-colors hover:bg-red-950/40"
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
                      className="shrink-0 rounded-xl bg-[#2C2926] px-5 py-2.5 font-heading text-xs font-bold uppercase tracking-wide text-white shadow-sm hover:bg-[#3A342E]"
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
                    className="w-full rounded-xl border-2 border-[#E2781E] bg-[#E2781E] py-3.5 font-heading text-xs font-bold uppercase tracking-wider text-black transition-opacity hover:bg-[#C96614] disabled:opacity-50"
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
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#E2781E] py-4 font-heading text-sm font-bold uppercase tracking-wide text-white shadow-md transition-transform hover:scale-[1.01] active:scale-[0.99]"
                  >
                    <span className="text-lg leading-none">+</span>
                    Nuevo producto
                  </button>
                  <ul className="max-h-[min(52vh,24rem)] space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-[#1D1B19] p-2 shadow-inner">
                    {productos.length === 0 ? (
                      <li className="py-10 text-center text-sm text-[#F3F4F6]/45">
                        Todavía no hay productos en el catálogo.
                      </li>
                    ) : (
                      productos.map((p) => (
                        <li
                          key={p.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-white/10 hover:bg-[#1D1B19]/30"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-heading text-sm font-bold text-[#F3F4F6]">
                              {p.name}
                            </p>
                            <p className="mt-0.5 text-xs text-[#E2781E]">
                              <span className="font-semibold text-[#E2781E]">
                                ${(p.price ?? 0).toLocaleString("es-AR")}
                              </span>
                              <span className="text-[#F3F4F6]/40"> · </span>
                              {p.category ?? "—"}
                              {typeof p.stock === "number" && (
                                <>
                                  <span className="text-[#F3F4F6]/40"> · </span>
                                  Stock {p.stock}
                                </>
                              )}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              className="rounded-lg border border-[#E2781E]/30 bg-[#E2781E]/10 px-3 py-2 font-heading text-[11px] font-bold uppercase tracking-wide text-[#F3F4F6] transition-colors hover:bg-[#E2781E]/20"
                              onClick={() => abrirEditar(p)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              disabled={borrandoId === p.id}
                              className="rounded-lg border border-red-500/30 bg-red-950/40 px-3 py-2 font-heading text-[11px] font-bold uppercase tracking-wide text-red-300 transition-colors hover:bg-red-950/50 disabled:opacity-50"
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
                  className="space-y-4 rounded-2xl border border-white/10 bg-[#1D1B19] p-4 shadow-sm sm:p-5"
                >
                  <button
                    type="button"
                    className="group flex items-center gap-2 font-heading text-xs font-bold uppercase tracking-wide text-[#E2781E] transition-colors hover:text-[#F3F4F6]"
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
                  <h3 className="border-b border-white/10 pb-2 font-heading text-base font-bold uppercase tracking-wide text-[#F3F4F6]">
                    {editando ? "Editar producto" : "Alta de producto"}
                  </h3>
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#E2781E]">
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
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#E2781E]">
                      Descripción{" "}
                      <span className="font-normal normal-case text-[#F3F4F6]/45">
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
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#E2781E]">
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
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#E2781E]">
                      Stock (unidades){" "}
                      <span className="font-normal normal-case text-[#F3F4F6]/45">
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
                    <p className="mt-1 text-[11px] leading-relaxed text-[#F3F4F6]/55">
                      0 = sin venta online. Vacío = no mostramos límite (productos viejos o reposición abierta).
                    </p>
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#E2781E]">
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

                  <fieldset className="space-y-3 rounded-2xl border border-white/10 bg-[#1D1B19]/25 p-4">
                    <legend className="px-1 font-heading text-[11px] font-bold uppercase tracking-wider text-[#F3F4F6]">
                      Imagen del producto
                    </legend>
                    <div className="flex flex-col gap-3">
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#1D1B19] p-3 shadow-sm transition-shadow has-[:checked]:ring-2 has-[:checked]:ring-[#E2781E]/30">
                        <input
                          type="radio"
                          name="modo-imagen"
                          checked={modoImagen === "url"}
                          onChange={() => {
                            setModoImagen("url");
                            setArchivo(null);
                          }}
                          className="mt-1 h-4 w-4 accent-[#E2781E]"
                        />
                        <span className="text-xs leading-snug text-[#F3F4F6]">
                          <span className="font-semibold">URL pública</span>
                          <span className="mt-0.5 block text-[11px] text-[#F3F4F6]/60">
                            Pegá el enlace directo a la imagen (.jpg, .png…)
                          </span>
                        </span>
                      </label>
                      {STORAGE_UPLOAD_HABILITADO && (
                        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-[#1D1B19] p-3 shadow-sm transition-shadow has-[:checked]:ring-2 has-[:checked]:ring-[#E2781E]/30">
                          <input
                            type="radio"
                            name="modo-imagen"
                            checked={modoImagen === "archivo"}
                            onChange={() => setModoImagen("archivo")}
                            className="mt-1 h-4 w-4 accent-[#E2781E]"
                          />
                          <span className="text-xs leading-snug text-[#F3F4F6]">
                            <span className="font-semibold">Archivo (Storage)</span>
                            <span className="mt-0.5 block text-[11px] text-[#F3F4F6]/60">
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
                          className="w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-[#E2781E] file:px-4 file:py-2 file:font-heading file:text-xs file:font-bold file:uppercase file:tracking-wide file:text-white"
                        />
                      )
                    )}
                    {STORAGE_UPLOAD_HABILITADO &&
                      editando &&
                      modoImagen === "archivo" &&
                      !archivo && (
                        <p className="text-[11px] text-[#F3F4F6]/55">
                          Sin archivo nuevo se conserva la imagen actual.
                        </p>
                      )}
                  </fieldset>

                  {formError && (
                    <p className="rounded-xl bg-red-950/40 px-3 py-2 text-xs text-red-300">
                      {formError}
                    </p>
                  )}
                  {formOk && (
                    <p className="rounded-xl bg-[#E2781E]/10 px-3 py-2 text-xs font-medium text-[#F3F4F6]">
                      {formOk}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={guardando}
                    className="w-full rounded-xl bg-[#E2781E] py-3.5 font-heading text-sm font-bold uppercase tracking-wide text-white shadow-md transition-opacity hover:opacity-95 disabled:opacity-50"
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
                <section className="space-y-5">
                  <div className="flex flex-col gap-4 rounded-xl border border-white/[0.08] bg-[#1D1B19] p-6 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <p className="font-heading text-xs font-bold uppercase tracking-widest text-[#E2781E]">
                        • Ventas & envíos
                      </p>
                      <h3 className="mt-1 font-heading text-2xl font-black uppercase tracking-wide text-white">
                        Gestión de pedidos
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#9CA3AF]">
                        Si cambiás artículos o cantidades, el cliente registrado debe confirmar desde «Mi cuenta» antes de que puedas poner el pedido en preparación. Al cancelar o rechazar un pedido, el stock se reincorpora al catálogo de forma automática.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void cargarPedidosAdmin()}
                      disabled={cargandoPedidos}
                      className="shrink-0 rounded-lg border border-white/10 bg-[#2C2926] px-4 py-2 font-heading text-xs font-bold uppercase tracking-wider text-white hover:bg-[#3A342E] disabled:opacity-50"
                    >
                      {cargandoPedidos ? "Cargando…" : "↻ Actualizar lista"}
                    </button>
                  </div>
                  <div className="rounded-xl border border-white/[0.08] bg-[#1D1B19] p-6">
                    <p className="font-heading text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                      ❓ Guía operativa para despachos
                    </p>
                    <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="rounded-lg border border-white/8 bg-[#2C2926] p-4">
                        <p className="font-heading text-xs font-bold uppercase text-[#E2781E]">Paso 01</p>
                        <p className="mt-2 font-heading text-xs font-bold uppercase text-white">Revisar pedidos entrantes</p>
                        <p className="mt-1 text-xs text-[#9CA3AF]">Revisá la lista de pedidos nuevos al menos dos veces al día para mantener una respuesta ágil.</p>
                      </div>
                      <div className="rounded-lg border border-white/8 bg-[#2C2926] p-4">
                        <p className="font-heading text-xs font-bold uppercase text-emerald-400">Paso 02</p>
                        <p className="mt-2 font-heading text-xs font-bold uppercase text-white">Contactar por WhatsApp</p>
                        <p className="mt-1 text-xs text-[#9CA3AF]">Coordiná detalles de entrega con el cliente y actualizá el estado del pedido en la plataforma.</p>
                      </div>
                      <div className="rounded-lg border border-white/8 bg-[#2C2926] p-4">
                        <p className="font-heading text-xs font-bold uppercase text-amber-400">Paso 03</p>
                        <p className="mt-2 font-heading text-xs font-bold uppercase text-white">Sincronización de stock</p>
                        <p className="mt-1 text-xs text-[#9CA3AF]">El stock de los productos se actualiza automáticamente al aprobar, enviar o cancelar ventas.</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="flex min-h-[11.5rem] flex-col rounded-xl border border-white/[0.08] bg-[#1D1B19] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-heading text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                          Ingresos del día
                        </p>
                        <IconCreditCard className="h-4 w-4 text-[#E8A882]" />
                      </div>
                      <p className="mt-3 font-heading text-3xl font-black tracking-tight text-white">
                        ${formatARS(kpisDia.ingresosHoy)}
                      </p>
                      <p className="mt-2 text-[11px] leading-relaxed text-emerald-400">
                        {kpisDia.deltaPctVsAyer === null ? (
                          "Sin ventas ayer para comparar"
                        ) : (
                          <>
                            ↗ {kpisDia.deltaPctVsAyer >= 0 ? "+" : ""}
                            {kpisDia.deltaPctVsAyer.toFixed(0)}% vs. ayer
                            {kpisDia.confirmadosHoy > 0
                              ? ` · Ticket prom. $${formatARS(Math.round(kpisDia.ticketPromedioHoy))}`
                              : ""}
                          </>
                        )}
                      </p>
                      <p className="mt-auto pt-3 text-xs text-emerald-400">
                        ✓ {kpisDia.confirmadosHoy} pedido{kpisDia.confirmadosHoy === 1 ? "" : "s"} confirmado
                        {kpisDia.confirmadosHoy === 1 ? "" : "s"} hoy
                      </p>
                    </div>

                    <div className="flex min-h-[11.5rem] flex-col rounded-xl border border-white/[0.08] bg-[#1D1B19] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-heading text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                          Pedidos a despachar
                        </p>
                        <IconTruck className="h-4 w-4 text-[#E8A882]" />
                      </div>
                      <p className="mt-3 flex items-baseline gap-2">
                        <span className="font-heading text-3xl font-black leading-none text-[#E2781E]">
                          {kpisDia.aDespachar}
                        </span>
                        <span className="font-heading text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                          Órdenes
                        </span>
                      </p>
                      <p className="mt-2 text-[11px] leading-relaxed text-[#E8A882]">
                        <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-[#E2781E]" />
                        {resumenPedidos.porEstado.recibido} nuevos · {resumenPedidos.porEstado.en_preparacion} en preparación
                      </p>
                      <p className="mt-auto pt-3 text-xs text-[#E8A882]">
                        ⏱ Tiempo est. de armado: ~{kpisDia.minutosArmadoEst} min
                      </p>
                    </div>

                    <div className="flex min-h-[11.5rem] flex-col rounded-xl border border-white/[0.08] bg-[#1D1B19] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-heading text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                          Visitas & conversión
                        </p>
                        <svg className="h-4 w-4 text-[#E8A882]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 14l4-4 3 3 7-8" />
                          <path strokeLinecap="round" d="M14 5h6v6" />
                        </svg>
                      </div>
                      <p className="mt-3 flex items-baseline gap-2">
                        <span className="font-heading text-3xl font-black leading-none text-white">0</span>
                        <span className="font-heading text-xs font-bold uppercase tracking-wider text-[#9CA3AF]">
                          Visitas hoy
                        </span>
                      </p>
                      <p className="mt-2 text-[11px] text-emerald-400">▣ 0% tasa de conversión</p>
                      <p className="mt-auto flex items-center gap-1.5 pt-3 text-xs text-[#9CA3AF]">
                        <IconCart className="h-3.5 w-3.5" />
                        Sin medición de visitas ni carritos aún
                      </p>
                    </div>

                    <div className="flex min-h-[11.5rem] flex-col rounded-xl border border-[#E2781E]/35 bg-[#1D1B19] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-heading text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                          Alertas de stock
                        </p>
                        <span className="text-[#E2781E]" aria-hidden>⚠</span>
                      </div>
                      <div className="mt-3 flex-1 space-y-2">
                        {resumenStock.criticos.length === 0 ? (
                          <p className="text-[11px] text-[#9CA3AF]">Sin alertas de inventario.</p>
                        ) : (
                          resumenStock.criticos.slice(0, 2).map((c) => (
                            <div key={c.name} className="flex items-center justify-between gap-2">
                              <p className="min-w-0 truncate font-heading text-[11px] font-bold uppercase tracking-wide text-white">
                                {c.name}
                              </p>
                              <span
                                className={`shrink-0 rounded-md px-1.5 py-0.5 font-heading text-[10px] font-bold tabular-nums ${
                                  c.stock === 0
                                    ? "bg-red-950/80 text-red-300"
                                    : "bg-[#E2781E]/20 text-[#E8A882]"
                                }`}
                              >
                                {c.stock} u.
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setTab("catalogo")}
                        className="mt-3 flex items-center justify-between font-heading text-[10px] font-bold uppercase tracking-wide text-[#E8A882] hover:text-white"
                      >
                        Ver inventario
                        <span aria-hidden>→</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-xl border border-white/[0.08] bg-[#1D1B19] p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center">
                      <label className="relative min-w-0 flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6B7280]">
                          <IconSearch className="h-4 w-4" />
                        </span>
                        <input
                          ref={busquedaPedidosRef}
                          type="search"
                          value={busquedaPedidos}
                          onChange={(e) => setBusquedaPedidos(e.target.value)}
                          placeholder="Buscar por ID (#fJaAK…), cliente, teléfono, producto o tracking Andreani…"
                          className="h-10 w-full rounded-lg border border-white/10 bg-[#151311] py-2 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/20"
                        />
                      </label>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={exportarPedidosCsv}
                          className="inline-flex h-10 items-center gap-1.5 rounded-[4px] border border-white/15 bg-[#151311] px-3 font-heading text-[10px] font-bold uppercase tracking-wide text-[#D1D5DB] hover:text-white"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                          </svg>
                          Exportar CSV
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setBusquedaPedidos("");
                            setFiltroEstado("todos");
                            setFiltroPeriodo("todos");
                          }}
                          className="inline-flex h-10 items-center gap-1.5 rounded-[4px] border border-white/15 bg-[#151311] px-3 font-heading text-[10px] font-bold uppercase tracking-wide text-[#D1D5DB] hover:text-white"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 0113.4-4.5M19.5 12A7.5 7.5 0 016.1 16.5M19.5 5v4.5H15M4.5 19v-4.5H9" />
                          </svg>
                          Limpiar
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {(
                        [
                          { id: "todos" as const, label: "Todos", count: pedidos.length, badge: "neutral" },
                          { id: "nuevos" as const, label: "Nuevos / Pendientes", count: resumenPedidos.porEstado.recibido, badge: "orange" },
                          { id: "en_preparacion" as const, label: "En preparación", count: resumenPedidos.porEstado.en_preparacion, badge: "orange" },
                          { id: "enviado" as const, label: "Enviados", count: resumenPedidos.porEstado.enviado, badge: "neutral" },
                          { id: "entregado" as const, label: "Entregados", count: resumenPedidos.porEstado.entregado, badge: "green" },
                        ]
                      ).map((pill) => {
                        const activo = filtroEstado === pill.id;
                        const badgeClass = activo
                          ? "bg-black/30 text-white"
                          : pill.badge === "orange"
                            ? "bg-[#E2781E] text-black"
                            : pill.badge === "green"
                              ? "bg-emerald-500 text-black"
                              : "bg-white/10 text-white";
                        return (
                          <button
                            key={pill.id}
                            type="button"
                            onClick={() => setFiltroEstado(pill.id)}
                            className={`inline-flex h-10 items-center gap-2.5 rounded-[4px] px-4 font-heading text-[11px] font-bold uppercase tracking-wide ${
                              activo
                                ? "bg-[#E2781E] text-white"
                                : "border border-white/15 bg-[#151311] text-[#9CA3AF] hover:text-white"
                            }`}
                          >
                            {pill.label}
                            <span className={`flex h-5 min-w-5 items-center justify-center rounded-[3px] px-1.5 text-[10px] tabular-nums ${badgeClass}`}>
                              {pill.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <label className="flex min-w-0 items-center gap-2">
                        <IconTruck className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
                        <span className="shrink-0 font-heading text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                          Entrega:
                        </span>
                        <span className="relative flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-[4px] border border-white/20 bg-[#151311]">
                          <select className="h-full w-full appearance-none bg-transparent px-3 pr-8 text-xs font-medium text-white outline-none">
                            <option>Todos los métodos</option>
                          </select>
                          <svg className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                          </svg>
                        </span>
                      </label>
                      <label className="flex min-w-0 items-center gap-2">
                        <svg className="h-4 w-4 shrink-0 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                          <rect x="3.5" y="5" width="17" height="15" rx="2" />
                          <path strokeLinecap="round" d="M8 3.5V7M16 3.5V7M3.5 10h17" />
                        </svg>
                        <span className="shrink-0 font-heading text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                          Período:
                        </span>
                        <span className="relative flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-[4px] border border-white/20 bg-[#151311]">
                          <select
                            value={filtroPeriodo}
                            onChange={(e) => setFiltroPeriodo(e.target.value as FiltroPeriodoPedidos)}
                            className="h-full w-full appearance-none bg-transparent px-3 pr-8 text-xs font-medium text-white outline-none"
                          >
                            <option value="todos">Todos</option>
                            <option value="hoy">
                              {`Hoy (${new Date().toLocaleDateString("es-AR", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })})`}
                            </option>
                            <option value="7d">Últimos 7 días</option>
                            <option value="mes">Este mes</option>
                          </select>
                          <svg className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                          </svg>
                        </span>
                      </label>
                      <label className="flex min-w-0 items-center gap-2">
                        <IconCreditCard className="h-4 w-4 shrink-0 text-[#9CA3AF]" />
                        <span className="shrink-0 font-heading text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                          Pago:
                        </span>
                        <span className="relative flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-[4px] border border-white/20 bg-[#151311]">
                          <select className="h-full w-full appearance-none bg-transparent px-3 pr-8 text-xs font-medium text-white outline-none">
                            <option>Todos los medios de pago</option>
                          </select>
                          <svg className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                          </svg>
                        </span>
                      </label>
                    </div>
                  </div>
                  {pedidoMsg && (
                    <div
                      className={`rounded-2xl border px-4 py-3 text-sm leading-snug ${
                        pedidoMsg.toLowerCase().includes("actualiz")
                          ? "border-[#E2781E]/25 bg-[#E2781E]/10 text-[#F3F4F6]"
                          : "border-[#E2781E]/25 bg-[#1F1B16] text-[#E8A882]"
                      }`}
                      role="alert"
                    >
                      <p className="font-medium">{pedidoMsg}</p>
                      {!pedidoMsg.toLowerCase().includes("actualiz") &&
                        pedidoMsg.toLowerCase().includes("permiso") && (
                          <p className="mt-2 text-xs text-[#F3F4F6]/75">
                            En el archivo <code className="rounded bg-[#1D1B19] px-1 py-0.5 text-[11px]">firestore.rules</code>, la función{" "}
                            <code className="rounded bg-[#1D1B19] px-1 py-0.5 text-[11px]">isCatalogAdmin</code> tiene que usar el mismo email
                            con el que iniciaste sesión. Luego publicá las reglas en Firebase → Firestore → Reglas.
                          </p>
                        )}
                    </div>
                  )}
                  {cargandoPedidos && pedidos.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-12">
                      <div
                        className="h-9 w-9 animate-spin rounded-full border-2 border-[#E2781E]/25 border-t-[#E2781E]"
                        aria-hidden
                      />
                      <p className="text-sm text-[#F3F4F6]/55">Cargando pedidos…</p>
                    </div>
                  ) : pedidos.length === 0 &&
                    !(pedidoMsg && !pedidoMsg.toLowerCase().includes("actualiz")) ? (
                    <div className="rounded-2xl border border-dashed border-white/15 bg-[#1D1B19]/60 py-12 text-center">
                      <p className="text-sm text-[#F3F4F6]/55">
                        Todavía no hay pedidos guardados desde la web.
                      </p>
                      <p className="mt-1 text-xs text-[#F3F4F6]/40">
                        Aparecen cuando un cliente envía el carrito con sesión iniciada.
                      </p>
                    </div>
                  ) : pedidosFiltrados.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/15 bg-[#1D1B19]/60 py-12 text-center">
                      <p className="text-sm text-[#F3F4F6]/55">Ningún pedido coincide con la búsqueda o los filtros.</p>
                    </div>
                  ) : (
                    <ul className="space-y-6">
                      {pedidosFiltrados.map((p) => (
                        <li
                          key={p.id}
                          className="space-y-5 rounded-xl border border-white/[0.08] bg-[#1D1B19] p-6"
                        >
                          <div className="grid items-start gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#E2781E]/15 text-[#E8A882]">
                                <IconTruck className="h-6 w-6" />
                              </span>
                              <div className="min-w-0">
                                <p className="flex flex-wrap items-center gap-2 font-heading text-[11px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                                  Pedido: <span className="font-mono text-white">{p.id}</span>
                                  {p.status === "recibido" && (
                                    <span className="rounded-full bg-[#E2781E] px-2 py-0.5 text-[9px] font-bold text-black">
                                      Nuevo
                                    </span>
                                  )}
                                  {p.status === "en_preparacion" && (
                                    <span className="rounded-full border border-[#E2781E]/40 bg-[#E2781E]/10 px-2 py-0.5 text-[9px] font-bold text-[#E8A882]">
                                      Prioritario
                                    </span>
                                  )}
                                </p>
                                <p className="mt-1 font-heading text-lg font-black uppercase tracking-wide text-white">
                                  {p.userEmail || "—"}
                                </p>
                                {p.createdAt && (
                                  <p className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[#9CA3AF]">
                                    <span className="inline-flex items-center gap-1.5">
                                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                                        <rect x="3.5" y="5" width="17" height="15" rx="2" />
                                        <path strokeLinecap="round" d="M8 3.5V7M16 3.5V7M3.5 10h17" />
                                      </svg>
                                      {`${String(p.createdAt.getDate()).padStart(2, "0")}/${String(p.createdAt.getMonth() + 1).padStart(2, "0")}/${p.createdAt.getFullYear()}`}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                                        <circle cx="12" cy="12" r="8" />
                                        <path strokeLinecap="round" d="M12 8v4l2.5 1.5" />
                                      </svg>
                                      {`${String(p.createdAt.getHours()).padStart(2, "0")}:${String(p.createdAt.getMinutes()).padStart(2, "0")} hs`}
                                    </span>
                                  </p>
                                )}
                              </div>
                            </div>
                            <label className="block w-full text-right">
                              <span className="block font-heading text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                                Estado del pedido
                              </span>
                              <span className="relative mt-1 flex h-12 w-full items-center overflow-hidden rounded-lg border border-white/10 bg-transparent">
                                <select
                                  value={p.status}
                                  onChange={(e) =>
                                    cambiarEstadoPedido(
                                      p.id,
                                      e.target.value as PedidoEstado
                                    )
                                  }
                                  disabled={actualizandoPedidoId === p.id}
                                  className="h-full w-full cursor-pointer appearance-none bg-transparent bg-none px-3 pr-9 text-center font-heading text-xs font-bold uppercase tracking-wide text-[#9CA3AF] outline-none disabled:opacity-50"
                                  aria-label={`Estado del pedido ${p.id}`}
                                >
                                  {PEDIDO_ESTADOS.map((s) => (
                                    <option key={s} value={s}>
                                      {etiquetaEstadoPedido(s)}
                                    </option>
                                  ))}
                                </select>
                                <svg
                                  className="pointer-events-none absolute right-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#D1D5DB]"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                  strokeWidth={2.2}
                                  aria-hidden
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                                </svg>
                              </span>
                            </label>
                          </div>
                          {pedidoClienteConfirmoNoVistoPorAdmin(p) && (
                            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-[#E2781E]/35 bg-[#1D1B19] px-3 py-2.5">
                              <span
                                className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full bg-[#E2781E] px-1.5 font-heading text-[11px] font-bold tabular-nums text-white"
                                title="Nuevo"
                              >
                                1
                              </span>
                              <p className="min-w-0 flex-1 text-[11px] font-semibold leading-snug text-[#F3F4F6]">
                                Pedido confirmado: el cliente aceptó la modificación en «Mi
                                cuenta».
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  void marcarConfirmacionClienteVista(p.id)
                                }
                                disabled={marcandoVistaConfirmacionId === p.id}
                                className="shrink-0 rounded-lg border border-[#E2781E]/40 bg-[#1D1B19] px-3 py-1.5 font-heading text-[10px] font-bold uppercase tracking-wide text-[#E2781E] transition-colors hover:bg-[#E2781E]/10 disabled:opacity-50"
                              >
                                {marcandoVistaConfirmacionId === p.id
                                  ? "…"
                                  : "Marcar visto"}
                              </button>
                            </div>
                          )}
                          {p.stockCommitted && (
                            <p className="sr-only">
                              Unidades descontadas del stock del catálogo (pedido en curso).
                            </p>
                          )}
                          <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,1fr)_12rem]">
                            <div className="min-w-0">
                              <p className="font-heading text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                                Productos del pedido
                              </p>
                              {p.items.map((i, idx) => {
                                const prod = productos.find((x) => x.id === i.productId);
                                return (
                                  <div key={`${i.productId}-${idx}`} className="mt-1.5">
                                    <p className="font-heading text-lg font-black uppercase leading-tight tracking-wide text-white">
                                      {i.name}{" "}
                                      <span className="text-[#E2781E]">× {i.quantity}</span>
                                    </p>
                                    {prod?.description ? (
                                      <p className="mt-0.5 max-w-md text-[11px] text-[#9CA3AF]">
                                        {prod.description}
                                      </p>
                                    ) : null}
                                  </div>
                                );
                              })}
                            </div>
                            <div className="text-right">
                              <p className="font-heading text-[10px] font-bold uppercase tracking-wider text-[#9CA3AF]">
                                Total del pedido
                              </p>
                              <p className="font-heading text-3xl font-black tracking-tight text-[#E8A882]">
                                ${formatARS(p.total)}
                              </p>
                            </div>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                            <button
                              type="button"
                              onClick={() => {
                                setPedidoMsg(null);
                                setPedidoEditando(p);
                              }}
                              disabled={guardandoItemsPedidoId !== null || actualizandoPedidoId === p.id}
                              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-dashed border-white/20 bg-transparent font-heading text-xs font-bold uppercase tracking-wide text-[#D1D5DB] hover:border-[#E2781E]/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                                <path strokeLinecap="round" d="M4 21h4l11-11-4-4L4 17v4z" />
                                <path strokeLinecap="round" d="M14.5 6.5l3 3" />
                              </svg>
                              [ Modificar pedido (cantidades / productos) ]
                            </button>
                            <button
                              type="button"
                              onClick={() => void eliminarPedido(p)}
                              disabled={eliminandoPedidoId === p.id || actualizandoPedidoId === p.id}
                              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/10 font-heading text-xs font-bold uppercase tracking-wide text-[#9CA3AF] hover:border-red-500/40 hover:bg-red-950/40 hover:text-red-400 disabled:opacity-50"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M9 7V5h6v2m-7 4v7m4-7v7m4-7v7M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12" />
                              </svg>
                              {eliminandoPedidoId === p.id ? "Eliminando…" : "Eliminar pedido"}
                            </button>
                          </div>
                          <div className="space-y-3 rounded-xl border border-white/[0.06] bg-[#151311] p-4">
                            {p.clientPhone ? (
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="inline-flex items-center gap-2 text-xs">
                                  <svg className="h-4 w-4 text-[#22C55E]" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                                  </svg>
                                  <span className="font-heading text-[11px] font-bold uppercase tracking-wider text-[#22C55E]">
                                    Canal directo WhatsApp:
                                  </span>
                                  <span className="font-medium text-white">{formatTelAR(p.clientPhone)}</span>
                                </p>
                                <span className="inline-flex items-center gap-1.5 font-heading text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                                  ✓ Número verificado
                                </span>
                              </div>
                            ) : (
                              <label className="block text-left">
                                <span className="font-heading text-[10px] font-bold uppercase tracking-wide text-[#E2781E]">
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
                                  className="mt-1 w-full rounded-lg border border-white/10 bg-[#1D1B19] px-2.5 py-2 text-xs text-white outline-none focus:ring-1 focus:ring-[#E2781E]/30"
                                />
                              </label>
                            )}
                            <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-white/[0.06] bg-[#1D1B19]/80 px-3 py-2.5 text-left text-xs leading-snug text-[#D1D5DB]">
                              <input
                                type="checkbox"
                                checked={waPedidoModificado[p.id] === true}
                                onChange={(e) => {
                                  const on = e.target.checked;
                                  setWaPedidoModificado((prev) => ({ ...prev, [p.id]: on }));
                                  if (on) {
                                    setWaPlantilla((prev) => ({ ...prev, [p.id]: "ajuste_stock" }));
                                  }
                                }}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[#E2781E]"
                              />
                              <span>
                                Incluir en el mensaje de WhatsApp que el pedido fue{" "}
                                <strong className="font-semibold text-white">modificado</strong> o{" "}
                                <strong className="font-semibold text-white">ajustado</strong> y que puede verificar el comprobante actualizado en «Mi cuenta».
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => abrirWhatsAppAlCliente(p)}
                              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#198754] font-heading text-xs font-bold uppercase tracking-wide text-white hover:bg-[#157347]"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z" />
                              </svg>
                              Enviar mensaje al cliente por WhatsApp
                            </button>
                          </div>
                          {p.status === "recibido" && (
                            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
                              <button
                                type="button"
                                disabled={actualizandoPedidoId === p.id}
                                onClick={() => void cambiarEstadoPedido(p.id, "en_preparacion")}
                                className="flex h-12 items-center justify-center gap-2 rounded-lg bg-[#E2781E] font-heading text-xs font-bold uppercase tracking-wide text-black hover:bg-[#C96614] disabled:opacity-50"
                              >
                                ✓ Aprobado y en preparación
                              </button>
                              <button
                                type="button"
                                disabled={actualizandoPedidoId === p.id}
                                onClick={() => void cambiarEstadoPedido(p.id, "cancelado")}
                                className="flex h-12 items-center justify-center gap-2 rounded-lg border border-white/10 bg-[#2C2926] font-heading text-xs font-semibold uppercase tracking-wide text-[#D1D5DB] hover:bg-red-950/40 hover:text-red-400 disabled:opacity-50"
                              >
                                ✕ Rechazar
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              <footer className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-white/[0.08] pt-5 sm:flex-row sm:items-center">
                <p className="font-heading text-[10px] font-bold uppercase tracking-widest text-[#6B7280]">
                  Sangre Nómade · Comercio online · Panel de comerciante
                </p>
                <p className="inline-flex items-center gap-2 font-heading text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Conexión segura
                </p>
              </footer>
            </>
          )}
        </div>

      <ModalModificarPedido
        pedido={pedidoEditando}
        productos={productos}
        open={Boolean(pedidoEditando)}
        guardando={guardandoItemsPedidoId === pedidoEditando?.id}
        onClose={() => setPedidoEditando(null)}
        onGuardar={guardarItemsPedidoFirestore}
      />
    </div>
  );
}
