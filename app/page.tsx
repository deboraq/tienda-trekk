"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { getDb, getFirebaseAuth } from "./firebase/config";
import { collection, getDocs } from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import confetti from "canvas-confetti";
import type { Product, CartItem } from "./types";
import { AdminTiendaPanel } from "./components/AdminTiendaPanel";
import { CuentaClientePanel } from "./components/CuentaClientePanel";
import { crearPedidoDesdeCarrito } from "./lib/pedidos";
import {
  WHATSAPP_NUMERO_TIENDA,
  normalizarTelefonoWa,
} from "./lib/whatsapp";
import {
  cargarConfigSitio,
  CATEGORIAS_DEFAULT_SIN_TODOS,
  TEXTO_LED_DEFAULT,
} from "./lib/site-config";
import { esCatalogAdminEmail } from "./lib/catalog-admin";
import {
  etiquetaStockVitrina,
  puedeAgregarUnidad,
  productoSinStock,
  stockDesdeFirestore,
} from "./lib/product-stock";

const SEGMENTOS_LED_MARQUEE = 6;

/** Paleta oficial Sangre Nómade Adventure (logo) */
const brand = {
  primary: "#2F3E46",
  accent: "#A65D37",
  forest: "#53634B",
  forestDark: "#3d4a38",
  cream: "#F2EBD3",
};

export default function Home() {
  const [productos, setProductos] = useState<Product[]>([]);
  const [textoMarqueeLed, setTextoMarqueeLed] = useState(TEXTO_LED_DEFAULT);
  const [categoriasMenu, setCategoriasMenu] = useState<string[]>(() => [
    "Todos",
    ...CATEGORIAS_DEFAULT_SIN_TODOS,
  ]);
  const [loading, setLoading] = useState(true);
  const [errorFirebase, setErrorFirebase] = useState<string | null>(null);

  const [carrito, setCarrito] = useState<CartItem[]>([]);
  const [mostrarResumen, setMostrarResumen] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState("Todos");
  const [mostrarCategorias, setMostrarCategorias] = useState(false);
  const [verTienda, setVerTienda] = useState(false);
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
  const [faqAbierto, setFaqAbierto] = useState<number | null>(null);
  const [imagenAmpliada, setImagenAmpliada] = useState<{ src: string; alt: string } | null>(null);
  const [mostrarFaqModal, setMostrarFaqModal] = useState(false);
  const [mostrarAdminCatalogo, setMostrarAdminCatalogo] = useState(false);
  const [mostrarCuentaCliente, setMostrarCuentaCliente] = useState(false);
  const [usuarioTienda, setUsuarioTienda] = useState<User | null>(null);
  const [finalizandoPedido, setFinalizandoPedido] = useState(false);
  /** Aviso en el panel del carrito (evita alert() y deja el botón listo de nuevo al instante). */
  const [avisoCheckout, setAvisoCheckout] = useState<string | null>(null);
  const [avisoCarrito, setAvisoCarrito] = useState<string | null>(null);
  /** WhatsApp de contacto (obligatorio al enviar pedido). */
  const [telefonoCheckout, setTelefonoCheckout] = useState("");
  const inputBusquedaCatalogRef = useRef<HTMLInputElement>(null);

  const categoriasParaProducto = categoriasMenu.filter((c) => c !== "Todos");

  const refrescarSitio = useCallback(async () => {
    try {
      const cfg = await cargarConfigSitio();
      setTextoMarqueeLed(cfg.marqueeText);
      setCategoriasMenu(["Todos", ...cfg.categoriasSinTodos]);
    } catch (e) {
      console.error("Error cargando config del sitio:", e);
    }
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const cfg = await cargarConfigSitio();
        if (!cancel) {
          setTextoMarqueeLed(cfg.marqueeText);
          setCategoriasMenu(["Todos", ...cfg.categoriasSinTodos]);
        }
      } catch (e) {
        console.error("Error cargando config del sitio:", e);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const cargarProductos = useCallback(async () => {
    try {
      setErrorFirebase(null);
      const querySnapshot = await getDocs(collection(getDb(), "productos"));
      const docs: Product[] = querySnapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name ?? "",
          description: d.description,
          price: Number(d.price) ?? 0,
          image: d.image ?? "",
          category: d.category,
          stock: stockDesdeFirestore(d.stock),
        };
      });
      setProductos(docs);
    } catch (error) {
      const permiso =
        error instanceof FirebaseError && error.code === "permission-denied";
      setErrorFirebase(
        permiso
          ? "Firebase bloqueó la lectura del catálogo (permisos). En la consola de Firebase → Firestore → Reglas, permití lectura pública de la colección «productos». El archivo firestore.rules en el proyecto tiene un ejemplo listo para pegar."
          : "No pudimos cargar los productos. Revisá tu conexión e intentá de nuevo."
      );
      console.error("Error trayendo productos de Firebase:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarProductos();
  }, [cargarProductos]);

  /** Si el admin baja el stock, ajustar cantidades en carrito. */
  useEffect(() => {
    setCarrito((prev) => {
      let changed = false;
      const next = prev
        .map((item) => {
          const p = productos.find((pr) => pr.id === item.product.id);
          const limite = p?.stock;
          if (typeof limite === "number" && item.quantity > limite) {
            changed = true;
            return { ...item, quantity: limite, product: p ?? item.product };
          }
          return item;
        })
        .filter((i) => i.quantity > 0);
      return changed ? next : prev;
    });
  }, [productos]);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsub = onAuthStateChanged(auth, setUsuarioTienda);
    return () => unsub();
  }, []);

  useEffect(() => {
    try {
      const g = localStorage.getItem("sn_wa_checkout");
      if (g) setTelefonoCheckout(g);
    } catch {
      /* ignore */
    }
  }, []);

  // Al pasar al catálogo escribiendo en el buscador, enfocar el input del catálogo para seguir escribiendo sin clic
  useEffect(() => {
    if (verTienda && busqueda.trim()) {
      const t = setTimeout(() => inputBusquedaCatalogRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [verTienda]);

  const productosFiltrados = productos.filter((p) => {
    const name = p.name?.toLowerCase() ?? "";
    const desc = (p.description ?? "").toLowerCase();
    const coincideBusqueda =
      name.includes(busqueda.toLowerCase()) || desc.includes(busqueda.toLowerCase());
    const coincideCategoria =
      categoriaSeleccionada === "Todos" || p.category === categoriaSeleccionada;
    return coincideBusqueda && coincideCategoria;
  });

  const productosDestacados = productos.slice(0, 3);

  const agregarAlCarrito = (producto: Product) => {
    const enCarrito = carrito.find((i) => i.product.id === producto.id)?.quantity ?? 0;
    if (!puedeAgregarUnidad(producto, enCarrito)) {
      setAvisoCarrito(
        productoSinStock(producto)
          ? "Este producto no tiene stock disponible."
          : "Llegaste al máximo de unidades disponibles."
      );
      window.setTimeout(() => setAvisoCarrito(null), 4000);
      return;
    }
    setCarrito((prev) => {
      const existe = prev.find((i) => i.product.id === producto.id);
      if (existe) {
        return prev.map((i) =>
          i.product.id === producto.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { product: producto, quantity: 1 }];
    });
    confetti({
      particleCount: 60,
      spread: 70,
      origin: { x: 0.5, y: 0.7 },
      colors: [brand.primary, brand.accent, brand.forest],
      zIndex: 9999,
    });
  };

  const eliminarDelCarrito = (productId: string) => {
    setCarrito((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const cambiarCantidad = (productId: string, delta: number) => {
    setCarrito((prev) => {
      const item = prev.find((i) => i.product.id === productId);
      if (!item) return prev;
      const p = productos.find((pr) => pr.id === productId) ?? item.product;
      let nueva = item.quantity + delta;
      if (delta > 0 && typeof p.stock === "number" && nueva > p.stock) {
        setAvisoCarrito("No hay más unidades disponibles de este producto.");
        window.setTimeout(() => setAvisoCarrito(null), 3500);
        nueva = p.stock;
      }
      return prev
        .map((i) =>
          i.product.id === productId ? { ...i, quantity: nueva, product: p } : i
        )
        .filter((i) => i.quantity > 0);
    });
  };

  const totalPrecio = carrito.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );
  const totalItems = carrito.reduce((acc, item) => acc + item.quantity, 0);

  const finalizarPedido = async () => {
    if (carrito.length === 0) return;
    const telNorm = normalizarTelefonoWa(telefonoCheckout);
    if (!telNorm) {
      setAvisoCheckout(
        "Ingresá un número de WhatsApp válido (incluí código de área, ej. +54 9 351 …)."
      );
      return;
    }
    try {
      localStorage.setItem("sn_wa_checkout", telefonoCheckout.trim());
    } catch {
      /* ignore */
    }
    for (const item of carrito) {
      const p = productos.find((pr) => pr.id === item.product.id) ?? item.product;
      if (typeof p.stock === "number" && item.quantity > p.stock) {
        setAvisoCheckout(
          "Hay productos con cantidad mayor al stock disponible. Revisá el carrito."
        );
        return;
      }
    }
    const listaProductos = carrito
      .map(
        (item) =>
          `- ${item.product.name} x${item.quantity} ($${item.product.price * item.quantity})`
      )
      .join("\n");

    // Abrir pestaña en el mismo instante del clic. Si primero hacemos await (Firestore),
    // el navegador bloquea window.open y no se abre WhatsApp.
    const pestañaWa = window.open("about:blank", "_blank");

    setAvisoCheckout(null);
    let refPedido = "";
    const u = getFirebaseAuth().currentUser;
    if (u) {
      setFinalizandoPedido(true);
      try {
        refPedido = await crearPedidoDesdeCarrito(
          u,
          carrito,
          totalPrecio,
          telNorm
        );
        setCarrito([]);
      } catch (e) {
        console.error(e);
        const code =
          e && typeof e === "object" && "code" in e
            ? String((e as { code?: string }).code)
            : "";
        const detalleReglas =
          code === "permission-denied"
            ? " Firebase aún no tiene permiso para «pedidos»: en Firebase Console → Firestore → Reglas, publicá el contenido del archivo firestore.rules de este proyecto (botón Publicar)."
            : "";
        setAvisoCheckout(
          `No pudimos guardar el pedido en tu cuenta.${detalleReglas} Podés abrir WhatsApp igual con el enlace de abajo.`
        );
      } finally {
        setFinalizandoPedido(false);
      }
    }

    const refBloque = refPedido
      ? `\n\n*Referencia web (seguimiento en Mi cuenta):*\n${refPedido}`
      : "";
    const contactoBloque = `\n\n*Mi WhatsApp:*\n+${telNorm}`;
    const mensaje =
      `¡Hola! Quiero realizar un pedido en *Sangre Nómade Adventure*:\n\n${listaProductos}\n\n*Total: $${totalPrecio}*${refBloque}${contactoBloque}\n\n¿Cómo coordinamos el pago?`;
    const urlWa = `https://wa.me/${WHATSAPP_NUMERO_TIENDA}?text=${encodeURIComponent(mensaje)}`;

    if (pestañaWa) {
      pestañaWa.location.href = urlWa;
    } else {
      window.location.href = urlWa;
    }
  };

  const abrirWhatsAppAsesoramiento = () => {
    const mensaje = "¡Hola Sangre Nómade! Tengo una consulta sobre...";
    window.open(
      `https://wa.me/${WHATSAPP_NUMERO_TIENDA}?text=${encodeURIComponent(mensaje)}`,
      "_blank"
    );
  };

  /** Cierra catálogo, menú móvil y sube al inicio (el botón Inicio antes no hacía scroll). */
  const irAlInicio = useCallback(() => {
    setVerTienda(false);
    setMenuMovilAbierto(false);
    setMostrarCategorias(false);
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 80);
  }, []);

  const irASeccion = useCallback((id: "nosotros" | "contacto") => {
    setVerTienda(false);
    setMenuMovilAbierto(false);
    setMostrarCategorias(false);
    window.setTimeout(() => {
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  }, []);

  return (
    <main className="min-h-screen pb-20 font-sans text-[#2F3E46]" style={{ backgroundColor: brand.cream }}>
      
      {/* --- NAVBAR --- */}
      <nav
        className="sticky top-0 z-50 border-b border-[#F2EBD3]/18 py-3 px-4 text-white shadow-[0_8px_32px_-8px_rgba(0,0,0,0.35)]"
        style={{
          background: `linear-gradient(165deg, ${brand.primary} 0%, #263530 48%, #1f2b26 100%)`,
        }}
      >
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 md:flex-nowrap md:gap-4 lg:gap-6">
          {/* Logo (izquierda) */}
          <div className="z-10 flex shrink-0 items-center gap-3">
            <button
              type="button"
              onClick={irAlInicio}
              className="flex items-center gap-2 md:gap-3 text-left font-bold font-heading whitespace-nowrap"
            >
              <Image
                src="/logo-sangre-nomade.png"
                alt="Sangre Nómade Adventure"
                width={72}
                height={72}
                className="h-14 w-14 shrink-0 rounded-full object-cover border-2 border-[#F2EBD3]/40 md:h-16 md:w-16"
                priority
              />
              <span className="text-base md:text-xl leading-tight">
                Sangre Nómade
                <span className="mt-0.5 block text-[9px] font-sans font-normal uppercase tracking-[0.2em] text-[#e8c9a8] sm:text-[10px] md:text-xs">
                  <span className="text-[#d4a574]">★</span> Adventure{" "}
                  <span className="text-[#d4a574]">★</span>
                </span>
              </span>
            </button>
            <button
              type="button"
              className="md:hidden p-2 rounded-lg hover:bg-white/10"
              onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}
              aria-expanded={menuMovilAbierto}
              aria-label={menuMovilAbierto ? "Cerrar menú" : "Abrir menú"}
            >
              {menuMovilAbierto ? <span className="text-xl">✕</span> : <span className="text-xl">☰</span>}
            </button>
          </div>

          {/* Centro: ocupa el espacio libre para no chocar con Mi cuenta / carrito (solo escritorio) */}
          <div className="hidden min-h-10 min-w-0 flex-1 items-center justify-center md:flex">
            <div className="flex max-w-full flex-wrap justify-center gap-x-5 gap-y-1 text-sm font-medium font-heading uppercase tracking-widest lg:gap-x-6 lg:text-base">
              <button
                type="button"
                onClick={irAlInicio}
                className="transition-colors hover:text-[#e8c9a8] uppercase"
              >
                Inicio
              </button>
              <a
                href="#nosotros"
                onClick={(e) => {
                  e.preventDefault();
                  irASeccion("nosotros");
                }}
                className="transition-colors hover:text-[#e8c9a8]"
              >
                Nosotros
              </a>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMostrarCategorias(!mostrarCategorias)}
                  className="flex items-center gap-1 uppercase tracking-widest outline-none transition-colors hover:text-[#e8c9a8]"
                >
                  Equipamiento {mostrarCategorias ? "▴" : "▾"}
                </button>
                {mostrarCategorias && (
                  <div className="absolute top-full left-1/2 z-50 mt-2 w-[min(100vw-2rem,18rem)] max-h-[70vh] -translate-x-1/2 overflow-x-hidden overflow-y-auto rounded-xl border-2 border-[#2F3E46]/20 bg-[#F2EBD3] font-sans text-[#2F3E46] shadow-2xl normal-case tracking-normal">
                    {categoriasMenu.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`w-full px-5 py-3 text-left text-sm transition-colors hover:bg-[#A65D37]/15 ${categoriaSeleccionada === cat ? "bg-[#53634B]/15 font-bold text-[#53634B]" : ""}`}
                        onClick={() => {
                          setCategoriaSeleccionada(cat);
                          setVerTienda(true);
                          setMostrarCategorias(false);
                        }}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <a
                href="#contacto"
                onClick={(e) => {
                  e.preventDefault();
                  irASeccion("contacto");
                }}
                className="transition-colors hover:text-[#e8c9a8]"
              >
                Contacto
              </a>
            </div>
          </div>

          {/* Derecha: ancho fijo = buscador; fila superior ocupa el mismo ancho (dos columnas iguales) */}
          <div className="z-10 ml-auto flex w-full max-w-md shrink-0 flex-col gap-2 md:w-[20rem] md:max-w-none lg:w-[22rem]">
            <div className="grid w-full grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMostrarCuentaCliente(true)}
                className="flex h-10 min-w-0 items-center justify-center rounded-full border border-[#2F3E46]/12 bg-[#F2EBD3] px-2 font-heading text-[9px] font-bold uppercase tracking-wide text-[#2F3E46] shadow-sm transition-all hover:border-[#A65D37]/35 hover:bg-[#e8dfc8] active:scale-[0.98] sm:text-[10px] sm:px-2.5 md:text-[11px] md:px-3"
              >
                <span className="text-center leading-tight">
                  {usuarioTienda ? "Mi cuenta" : "Iniciar sesión"}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setMostrarResumen(!mostrarResumen)}
                className="flex h-10 min-w-0 items-center justify-center gap-1 rounded-full border border-[#2F3E46]/12 bg-[#F2EBD3] px-2 font-heading text-[10px] font-bold uppercase tracking-wide text-[#2F3E46] shadow-sm transition-all hover:border-[#53634B]/35 hover:bg-[#e8dfc8] active:scale-[0.98] sm:gap-1.5 sm:text-[11px] sm:px-3"
                aria-label={`Tu carrito tiene ${totalItems} producto(s)`}
              >
                <svg className="h-3.5 w-3.5 shrink-0 text-[#53634B] sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span className="truncate">Carrito</span>
                <span className="min-w-[1.1rem] shrink-0 rounded-md bg-[#53634B]/15 px-0.5 text-center text-[10px] tabular-nums leading-none text-[#53634B] sm:min-w-[1.25rem] sm:text-[11px]">
                  {totalItems}
                </span>
              </button>
            </div>
            {!verTienda && (
              <div className="relative w-full">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#F2EBD3]/55" aria-hidden>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    if (e.target.value.trim()) setVerTienda(true);
                  }}
                  placeholder="Buscar equipamiento…"
                  className="h-10 w-full rounded-full border border-[#F2EBD3]/22 bg-[#F2EBD3]/10 pl-10 pr-9 text-[13px] leading-none text-[#F2EBD3] outline-none transition-all placeholder:text-[#F2EBD3]/45 focus:border-[#e8c9a8]/55 focus:bg-[#F2EBD3]/16 focus:ring-2 focus:ring-[#A65D37]/25"
                  aria-label="Buscar productos"
                />
                {busqueda && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-[#F2EBD3]/60 transition-colors hover:bg-white/10 hover:text-[#F2EBD3]"
                    onClick={() => setBusqueda("")}
                    aria-label="Borrar búsqueda"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Menú móvil: buscador solo en pantalla principal */}
        {menuMovilAbierto && (
          <div className="md:hidden mt-4 pt-4 border-t border-white/20 flex flex-col gap-2 text-sm uppercase tracking-widest">
            {!verTienda && (
              <div className="relative mb-2">
                <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[#F2EBD3]/55" aria-hidden>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    if (e.target.value.trim()) setVerTienda(true);
                  }}
                  placeholder="Buscar equipamiento…"
                  className="w-full rounded-full border border-[#F2EBD3]/22 bg-[#F2EBD3]/10 py-2.5 pl-10 pr-8 text-sm normal-case text-[#F2EBD3] outline-none transition-all placeholder:text-[#F2EBD3]/45 focus:border-[#e8c9a8]/55 focus:bg-[#F2EBD3]/16 focus:ring-2 focus:ring-[#A65D37]/25"
                  aria-label="Buscar productos"
                />
                {busqueda && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-[#F2EBD3]/60 hover:bg-white/10 hover:text-[#F2EBD3]"
                    onClick={() => setBusqueda("")}
                    aria-label="Borrar"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={irAlInicio}
              className="text-left py-2 uppercase tracking-widest hover:text-[#e8c9a8]"
            >
              Inicio
            </button>
            <a
              href="#nosotros"
              onClick={(e) => {
                e.preventDefault();
                irASeccion("nosotros");
              }}
              className="py-2 hover:text-[#e8c9a8]"
            >
              Nosotros
            </a>
            <button
              type="button"
              onClick={() => {
                setVerTienda(true);
                setCategoriaSeleccionada("Todos");
                setMenuMovilAbierto(false);
              }}
              className="text-left py-2 hover:text-[#e8c9a8]"
            >
              Ver equipamiento
            </button>
            <a
              href="#contacto"
              onClick={(e) => {
                e.preventDefault();
                irASeccion("contacto");
              }}
              className="py-2 hover:text-[#e8c9a8]"
            >
              Contacto
            </a>
            <button
              type="button"
              onClick={() => {
                setMostrarCuentaCliente(true);
                setMenuMovilAbierto(false);
              }}
              className="text-left py-2 hover:text-[#e8c9a8]"
            >
              {usuarioTienda ? "Mi cuenta" : "Iniciar sesión"}
            </button>
            <div className="pt-2 border-t border-white/20">
              <p className="text-xs normal-case opacity-80 mb-2">Productos por categoría</p>
              <div className="flex flex-wrap gap-2">
                {categoriasMenu.filter((c) => c !== "Todos").map((cat) => (
                  <button
                    key={cat}
                    className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs"
                    onClick={() => {
                      setCategoriaSeleccionada(cat);
                      setVerTienda(true);
                      setMenuMovilAbierto(false);
                    }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Carrito flotante */}
      {mostrarResumen && (
        <div
          className="animate-in fade-in slide-in-from-top-4 duration-300 fixed inset-x-4 top-20 z-[60] rounded-3xl border-2 border-[#2F3E46]/12 bg-gradient-to-b from-[#fefdfb] to-[#F2EBD3]/35 p-5 shadow-[0_20px_50px_-12px_rgba(47,62,70,0.35)] md:left-auto md:right-6 md:w-[22rem]"
          role="dialog"
          aria-labelledby="carrito-titulo"
        >
          <div className="mb-4 flex items-start justify-between gap-2 border-b border-[#2F3E46]/10 pb-3">
            <div>
              <p className="font-heading text-[10px] font-semibold uppercase tracking-[0.18em] text-[#A65D37]">
                Sangre Nómade
              </p>
              <h2 id="carrito-titulo" className="font-heading text-lg font-bold uppercase tracking-wide text-[#2F3E46]">
                Tu pedido
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                setMostrarResumen(false);
                setAvisoCheckout(null);
              }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#2F3E46]/10 text-[#2F3E46]/50 transition-colors hover:bg-[#2F3E46]/5 hover:text-[#2F3E46]"
              aria-label="Cerrar carrito"
            >
              ✕
            </button>
          </div>
          <div className="mb-4 max-h-60 space-y-2 overflow-y-auto pr-1">
            {carrito.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#2F3E46]/50">Tu carrito está vacío.</p>
            ) : (
              carrito.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-[#2F3E46]/8 bg-white/70 px-3 py-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="block font-medium text-[#2F3E46]">{item.product.name}</span>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2F3E46]/12 bg-[#F2EBD3]/40 text-[#2F3E46] transition-colors hover:bg-[#F2EBD3]"
                        onClick={() => cambiarCantidad(item.product.id, -1)}
                        aria-label="Restar uno"
                      >
                        −
                      </button>
                      <span className="w-7 text-center font-heading font-bold text-[#2F3E46]">{item.quantity}</span>
                      <button
                        type="button"
                        disabled={
                          typeof item.product.stock === "number" &&
                          item.quantity >= item.product.stock
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#2F3E46]/12 bg-[#F2EBD3]/40 text-[#2F3E46] transition-colors hover:bg-[#F2EBD3] disabled:cursor-not-allowed disabled:opacity-35"
                        onClick={() => cambiarCantidad(item.product.id, 1)}
                        aria-label="Sumar uno"
                      >
                        +
                      </button>
                    </div>
                    {typeof item.product.stock === "number" && (
                      <p className="mt-1 text-[10px] text-[#2F3E46]/45">
                        Máx. {item.product.stock} u. en stock
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-heading font-bold text-[#53634B]">
                      ${(item.product.price * item.quantity).toLocaleString("es-AR")}
                    </span>
                    <button
                      type="button"
                      onClick={() => eliminarDelCarrito(item.product.id)}
                      className="text-xs font-medium text-[#A65D37] underline-offset-2 hover:underline"
                      aria-label="Quitar del carrito"
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {carrito.length > 0 && (
            <>
              <div className="mb-3 rounded-xl border border-[#53634B]/20 bg-[#53634B]/8 px-3 py-2.5">
                <p className="font-heading text-xs font-bold uppercase tracking-wider text-[#2F3E46]/70">
                  Total estimado
                </p>
                <p className="font-heading text-2xl font-bold text-[#2F3E46]">
                  ${totalPrecio.toLocaleString("es-AR")}
                </p>
              </div>
              <label className="mb-3 block text-left">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#53634B]">
                  Tu WhatsApp <span className="text-red-700">*</span>
                </span>
                <input
                  type="tel"
                  autoComplete="tel"
                  inputMode="tel"
                  value={telefonoCheckout}
                  onChange={(e) => setTelefonoCheckout(e.target.value)}
                  placeholder="Ej. +54 9 351 123-4567"
                  className="mt-1.5 w-full rounded-xl border border-[#2F3E46]/12 bg-white px-3.5 py-2.5 text-sm text-[#2F3E46] shadow-sm outline-none placeholder:text-[#2F3E46]/35 focus:border-[#53634B] focus:ring-2 focus:ring-[#53634B]/20"
                />
                <span className="mt-1 block text-[10px] leading-snug text-[#2F3E46]/55">
                  {usuarioTienda
                    ? "Lo guardamos con tu pedido para que podamos escribirte desde la tienda."
                    : "Obligatorio: lo incluimos en el mensaje a la tienda para que tengan tu contacto."}
                </span>
              </label>
              {avisoCheckout && (
                <div
                  className="mb-3 rounded-2xl border border-[#A65D37]/30 bg-[#fdf6f0] px-3 py-3 text-xs leading-relaxed text-[#5c3319]"
                  role="alert"
                >
                  {avisoCheckout}
                </div>
              )}
              {!usuarioTienda && (
                <p className="mb-3 text-xs leading-relaxed text-[#2F3E46]/65">
                  Para que el pedido quede en la nube y lo sigas después, usá «Iniciar sesión» antes de enviar.
                </p>
              )}
              <button
                type="button"
                onClick={() => void finalizarPedido()}
                disabled={finalizandoPedido}
                className="w-full rounded-2xl bg-[#53634B] py-3.5 font-heading text-sm font-bold uppercase tracking-wide text-white shadow-md transition-all hover:bg-[#3d4a38] disabled:pointer-events-none disabled:opacity-55"
              >
                {finalizandoPedido ? "Guardando…" : "Enviar por WhatsApp"}
              </button>
              <div className="mt-3 space-y-2">
                <p className="text-center text-xs leading-relaxed text-[#2F3E46]/85">
                  <span className="font-semibold text-[#2F3E46]">Te respondemos por WhatsApp.</span>
                  {usuarioTienda
                    ? " Podés seguir el pedido en «Mi cuenta»."
                    : " Si entrás con tu cuenta antes de enviar, también podés seguirlo en «Mi cuenta»."}
                </p>
                <p className="text-center text-[10px] text-[#2F3E46]/45">
                  Se abre WhatsApp con tu pedido; coordinás pago y envío ahí.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {avisoCarrito && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-[225] max-w-sm -translate-x-1/2 rounded-2xl border border-[#2F3E46]/15 bg-[#fefdfb] px-4 py-3 text-center text-sm text-[#2F3E46] shadow-[0_12px_40px_-12px_rgba(47,62,70,0.35)] md:bottom-10"
        >
          {avisoCarrito}
        </div>
      )}

      {/* Lightbox: foto ampliada */}
      {imagenAmpliada && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setImagenAmpliada(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Imagen ampliada"
          style={{ position: "fixed" }}
        >
          <button
            type="button"
            className="absolute top-4 right-4 z-[210] w-12 h-12 rounded-full bg-white text-gray-800 flex items-center justify-center text-xl hover:bg-gray-100 transition-colors shadow-lg"
            onClick={(e) => { e.stopPropagation(); setImagenAmpliada(null); }}
            aria-label="Cerrar imagen"
          >
            ✕
          </button>
          <div
            className="relative max-w-4xl w-full max-h-[90vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagenAmpliada.src}
              alt={imagenAmpliada.alt}
              className="max-w-full max-h-[90vh] w-auto object-contain rounded-lg shadow-2xl"
              draggable={false}
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

      {/* --- CONTENIDO --- */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#53634B]" aria-hidden></div>
          <p className="mt-4 text-gray-500 italic">Cargando catálogo desde la nube...</p>
        </div>
      ) : errorFirebase ? (
        <div className="flex flex-col items-center justify-center min-h-[20rem] px-6 text-center">
          <p className="text-red-600 font-medium mb-2">{errorFirebase}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              cargarProductos();
            }}
            className="bg-[#53634B] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#3d4a38] transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : !verTienda ? (
        <>
          <div
            className="border-b border-[#2F3E46]/50 bg-gradient-to-r from-[#1a2320] via-[#152018] to-[#1a2320] py-1.5 shadow-[inset_0_1px_0_rgba(242,235,211,0.07)]"
            role="region"
            aria-label="Equipo técnico multimarcas para senderistas y montañistas"
          >
            <div className="overflow-hidden">
              <div
                className="sn-marquee-track sn-marquee-led-text flex w-max font-heading text-[11px] font-semibold uppercase leading-snug tracking-[0.14em] text-[#e8d4b8] sm:text-xs"
                style={
                  { "--sn-marquee-segments": SEGMENTOS_LED_MARQUEE } as React.CSSProperties
                }
              >
                {Array.from({ length: SEGMENTOS_LED_MARQUEE }, (_, i) => (
                  <span
                    key={i}
                    className="inline-block shrink-0 whitespace-nowrap px-6 py-0.5 sm:px-8"
                    aria-hidden={i > 0}
                  >
                    {textoMarqueeLed}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <section className="border-y border-[#A65D37]/30 bg-[#ddd0bc] py-12 text-center">
            <h3 className="mb-2 font-heading text-2xl font-bold uppercase tracking-wide text-[#2F3E46]">
              Expertos en el terreno, nómades por instinto
            </h3>
            <p className="text-[#2F3E46]/80 px-4 max-w-lg mx-auto">
              Escribinos para consultar talles, stock, envíos o recomendaciones de equipo según tu próxima ruta
            </p>
            <button
              onClick={abrirWhatsAppAsesoramiento}
              className="mt-4 text-white px-8 py-3 rounded-full font-bold hover:scale-105 transition-transform shadow-md font-heading uppercase tracking-wider text-sm border-2 border-[#2F3E46]/20"
              style={{ backgroundColor: "#A65D37" }}
            >
              Asesoramiento por WhatsApp
            </button>
          </section>

          <section id="destacados" className="border-t border-[#2F3E46]/10 bg-[#f4f0e8] py-4">
            <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 text-center">
            <p className="text-xs uppercase tracking-[0.2em] text-[#A65D37] font-heading mb-2">Pack aventura · Próximamente kits completos</p>
            <h3 className="mb-10 font-heading text-3xl font-bold uppercase text-[#2F3E46]">Equipamiento destacado</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {productosDestacados.map((producto) => {
                const q =
                  carrito.find((i) => i.product.id === producto.id)?.quantity ?? 0;
                const badge = etiquetaStockVitrina(producto);
                const noPuede = productoSinStock(producto) || !puedeAgregarUnidad(producto, q);
                return (
                  <div
                    key={producto.id}
                    className="rounded-3xl overflow-hidden border-2 border-[#2F3E46]/15 bg-[#fefdfb] p-4 shadow-[0_12px_36px_-14px_rgba(47,62,70,0.28)] transition-all hover:border-[#53634B]/35 hover:shadow-[0_16px_44px_-12px_rgba(47,62,70,0.32)]"
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      className="relative h-48 w-full rounded-2xl mb-4 overflow-hidden bg-[#e8e4dc] ring-1 ring-inset ring-[#2F3E46]/10 block w-full cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-[#53634B] focus:ring-offset-2"
                      onClick={() => producto.image && setImagenAmpliada({ src: producto.image, alt: producto.name })}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); producto.image && setImagenAmpliada({ src: producto.image, alt: producto.name }); } }}
                      aria-label={`Ver foto ampliada de ${producto.name}`}
                    >
                      <Image
                        src={producto.image}
                        alt={producto.name}
                        fill
                        className="object-cover pointer-events-none"
                        sizes="(max-width:768px) 100vw, 33vw"
                        unoptimized
                        referrerPolicy="no-referrer"
                      />
                      <span className="absolute inset-0 flex items-end justify-center pb-2 text-white text-sm font-medium bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity">Ver más grande</span>
                    </div>
                    <h4 className="text-xl font-bold">{producto.name}</h4>
                    <p className="text-2xl font-black text-[#53634B] my-4">${(producto.price ?? 0).toLocaleString("es-AR")}</p>
                    {badge && (
                      <p
                        className={`mb-2 text-xs font-semibold ${productoSinStock(producto) ? "text-red-700" : "text-[#53634B]"}`}
                      >
                        {badge}
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={noPuede}
                      onClick={() => agregarAlCarrito(producto)}
                      className={`w-full rounded-xl py-2 font-bold transition-all ${
                        noPuede
                          ? "cursor-not-allowed bg-[#2F3E46]/25 text-white"
                          : "bg-[#53634B] text-white active:scale-95"
                      }`}
                    >
                      {productoSinStock(producto) ? "Sin stock" : "Agregar al Carrito"}
                    </button>
                  </div>
                );
              })}
            </div>
            <button 
              onClick={() => setVerTienda(true)}
              className="mt-12 border-2 border-[#53634B] bg-[#fefdfb] text-[#53634B] px-10 py-4 rounded-full font-bold shadow-md hover:bg-[#53634B] hover:text-white transition-all"
            >
              Ver equipamiento completo →
            </button>
            </div>
          </section>

          <section id="nosotros" className="text-white py-20 px-6 mt-20 border-t-2 border-[#F2EBD3]/20" style={{ backgroundColor: brand.primary }}>
            <div className="max-w-4xl mx-auto text-center">
              <h3 className="text-4xl font-heading font-bold mb-8 uppercase tracking-wide">Nuestra esencia</h3>
              <p className="text-xl md:text-2xl leading-relaxed opacity-95 italic font-light px-4">
                Sangre Nómada nace en Córdoba, Argentina. Combinamos la precisión técnica con la pasión auténtica de quienes han dormido bajo las estrellas. Seleccionamos cada calzado y accesorio con el rigor de quien prueba cada costura en el terreno, para ofrecerte equipo de alta resistencia que asegure que nada te detenga en la ruta.
              </p>
            </div>
          </section>
        </>
      ) : (
        <section id="productos" className="max-w-6xl mx-auto p-4 pt-16 min-h-screen">
          <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-4">
            <button
              type="button"
              onClick={irAlInicio}
              className="shrink-0 flex items-center gap-2 font-heading font-bold uppercase tracking-wide text-[#53634B] hover:underline"
            >
              <span aria-hidden>←</span> Volver al inicio
            </button>
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">🔍</span>
              <input
                ref={inputBusquedaCatalogRef}
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar en el catálogo..."
                className="w-full pl-10 pr-10 py-2.5 rounded-full border-2 border-gray-200 outline-none focus:border-[#53634B] transition-all"
                aria-label="Buscar productos"
              />
              {busqueda && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                  onClick={() => setBusqueda("")}
                  aria-label="Borrar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
          <h3 className="text-4xl font-bold mb-8 text-[#2F3E46] font-heading uppercase tracking-wide">
            Equipamiento · {categoriaSeleccionada}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
            {productosFiltrados.map((producto) => (
              <div
                key={producto.id}
                className="flex flex-col overflow-hidden rounded-3xl border-2 border-[#2F3E46]/15 bg-[#fefdfb] shadow-[0_12px_36px_-14px_rgba(47,62,70,0.28)] transition-all hover:border-[#53634B]/35 hover:shadow-[0_16px_44px_-12px_rgba(47,62,70,0.32)]"
              >
                <div
                  role="button"
                  tabIndex={0}
                  className="relative h-64 overflow-hidden bg-[#e8e4dc] ring-1 ring-inset ring-[#2F3E46]/10 block w-full cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-[#53634B] focus:ring-offset-2"
                  onClick={() => producto.image && setImagenAmpliada({ src: producto.image, alt: producto.name })}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); producto.image && setImagenAmpliada({ src: producto.image, alt: producto.name }); } }}
                  aria-label={`Ver foto ampliada de ${producto.name}`}
                >
                  <Image
                    src={producto.image}
                    alt={producto.name}
                    fill
                    className="object-cover pointer-events-none"
                    sizes="(max-width:768px) 100vw, 33vw"
                    unoptimized
                    referrerPolicy="no-referrer"
                  />
                  <span className="absolute inset-0 flex items-end justify-center pb-2 text-white text-sm font-medium bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity">Ver más grande</span>
                </div>
                <div className="p-6 text-center flex-grow flex flex-col justify-between">
                  <div>
                    <h4 className="text-xl font-bold mb-2">{producto.name}</h4>
                    <p className="text-gray-500 text-sm mb-4">{producto.description}</p>
                    <p className="text-3xl font-black text-[#53634B] mb-6">${(producto.price ?? 0).toLocaleString("es-AR")}</p>
                    {(() => {
                      const q =
                        carrito.find((i) => i.product.id === producto.id)?.quantity ?? 0;
                      const badge = etiquetaStockVitrina(producto);
                      const noPuede =
                        productoSinStock(producto) || !puedeAgregarUnidad(producto, q);
                      return (
                        <>
                          {badge && (
                            <p
                              className={`mb-3 text-xs font-semibold ${productoSinStock(producto) ? "text-red-700" : "text-[#53634B]"}`}
                            >
                              {badge}
                            </p>
                          )}
                          <button
                            type="button"
                            disabled={noPuede}
                            onClick={() => agregarAlCarrito(producto)}
                            className={`w-full rounded-2xl py-3 font-bold shadow-md transition-all ${
                              noPuede
                                ? "cursor-not-allowed bg-[#2F3E46]/25 text-white"
                                : "bg-[#53634B] text-white active:scale-95"
                            }`}
                          >
                            {productoSinStock(producto) ? "Sin stock" : "Agregar al Carrito"}
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {productosFiltrados.length === 0 && (
            <div className="col-span-full rounded-3xl border-2 border-dashed border-[#2F3E46]/25 bg-[#fefdfb] py-20 text-center shadow-[0_8px_28px_-12px_rgba(47,62,70,0.15)]">
               <p className="text-gray-500 text-xl italic mb-4">No encontramos productos en "{categoriaSeleccionada}".</p>
               <button 
                 onClick={() => {setCategoriaSeleccionada("Todos"); setBusqueda("");}}
                 className="bg-[#53634B] text-white px-6 py-2 rounded-full font-bold hover:bg-[#3d4a38] transition-colors"
               >
                 Ver todo el equipamiento
               </button>
            </div>
          )}
        </section>
      )}

      {/* Preguntas frecuentes — CTA visible */}
      <section className="mx-auto max-w-3xl px-4 py-14 text-center sm:px-6">
        <button
          type="button"
          onClick={() => setMostrarFaqModal(true)}
          className="inline-flex w-full max-w-xl items-center justify-center gap-3 rounded-2xl border-2 border-[#2F3E46]/25 bg-[#A65D37] px-6 py-5 text-base font-heading font-bold uppercase tracking-[0.12em] text-white shadow-[0_12px_40px_-8px_rgba(166,93,55,0.55)] transition-all hover:bg-[#8f4e2f] hover:shadow-[0_16px_44px_-8px_rgba(47,62,70,0.35)] focus:outline-none focus:ring-4 focus:ring-[#A65D37]/40 active:scale-[0.99] md:px-12 md:py-6 md:text-xl"
        >
          <span className="text-2xl md:text-3xl" aria-hidden>
            ❓
          </span>
          Preguntas frecuentes
        </button>
        <p className="mt-4 text-sm text-[#2F3E46]/65">
          Envíos, pagos y cómo comprar
        </p>
      </section>

      {/* Modal Preguntas Frecuentes */}
      {mostrarFaqModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setMostrarFaqModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="faq-modal-title"
          style={{ position: "fixed" }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col z-[210]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-100">
              <h3 id="faq-modal-title" className="text-2xl font-bold text-gray-800">Preguntas Frecuentes</h3>
              <button
                type="button"
                className="w-10 h-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 shrink-0"
                onClick={(e) => { e.stopPropagation(); setMostrarFaqModal(false); }}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-2">
              {[
                {
                  id: 0,
                  pregunta: "¿Cómo comprar?",
                  respuesta:
                    "Elegí del equipamiento, agregá al carrito y enviá el pedido por WhatsApp para coordinar pago y envío a todo el país. Si creás una cuenta e iniciás sesión antes de enviar, el pedido queda registrado y podés ver el estado en «Mi cuenta».",
                },
                {
                  id: 1,
                  pregunta: "Envíos",
                  respuesta:
                    "Enviamos a todo el país. Los tiempos y costos te los confirmamos al cerrar el pedido.",
                },
                {
                  id: 2,
                  pregunta: "¿Asesoramiento?",
                  respuesta:
                    "Podés consultarnos por talles, capas para el clima o equipo según la ruta. Escribinos antes de comprar.",
                },
              ].map((faq) => (
                <div key={faq.id} className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                  <button
                    type="button"
                    className="w-full text-left px-5 py-4 font-bold text-lg flex justify-between items-center hover:bg-gray-100 transition-colors"
                    onClick={() => setFaqAbierto(faqAbierto === faq.id ? null : faq.id)}
                    aria-expanded={faqAbierto === faq.id}
                  >
                    {faq.pregunta}
                    <span className="text-[#53634B] text-xl">{faqAbierto === faq.id ? "−" : "+"}</span>
                  </button>
                  {faqAbierto === faq.id && (
                    <div className="px-5 pb-4 text-gray-600 text-sm border-t border-gray-200 pt-2">
                      {faq.respuesta}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setMostrarFaqModal(false)}
                className="w-full bg-[#53634B] text-white py-3 rounded-xl font-bold hover:bg-[#3d4a38] transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer id="contacto" className="bg-[#F2EBD3]/50 border-t-2 border-[#2F3E46]/10 py-16 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
          <div>
            <h4 className="font-bold mb-4 text-xl text-[#2F3E46] font-heading uppercase tracking-wide text-lg">Contacto</h4>
            <p className="text-gray-600">WhatsApp: +54 9 351 541-6836</p>
            <p className="text-gray-600">Email: hola@sangrenomade.com</p>
          </div>
          <div>
            <h4 className="font-bold mb-4 text-xl text-[#2F3E46] font-heading uppercase tracking-wide text-lg">Redes</h4>
            <div className="flex justify-center md:justify-start gap-4">
              <a href="https://instagram.com/sangrenomade" target="_blank" rel="noopener noreferrer" className="bg-[#F2EBD3] p-2 rounded-full border border-[#2F3E46]/15 hover:bg-[#A65D37]/15 transition-colors font-medium">Instagram</a>
              <a href="https://facebook.com/sangrenomade" target="_blank" rel="noopener noreferrer" className="bg-[#F2EBD3] p-2 rounded-full border border-[#2F3E46]/15 hover:bg-[#A65D37]/15 transition-colors font-medium">Facebook</a>
            </div>
          </div>
          <div className="flex flex-col items-center space-y-3 md:items-start">
            <h4 className="text-xl font-bold font-heading uppercase tracking-wide text-lg text-[#2F3E46]">
              Sangre Nómade Adventure
            </h4>
            <p className="text-sm text-gray-600">© 2026 - Córdoba, Argentina.</p>
            {(!usuarioTienda || esCatalogAdminEmail(usuarioTienda.email)) && (
              <button
                type="button"
                onClick={() => setMostrarAdminCatalogo(true)}
                className="rounded-md bg-transparent px-1 py-0.5 text-center font-heading text-[10px] font-semibold uppercase tracking-[0.15em] text-[#53634B]/80 transition-colors hover:text-[#2F3E46] md:text-left"
              >
                Administrar tienda
              </button>
            )}
          </div>
        </div>
      </footer>

      <CuentaClientePanel
        open={mostrarCuentaCliente}
        onClose={() => setMostrarCuentaCliente(false)}
      />

      <AdminTiendaPanel
        open={mostrarAdminCatalogo}
        onClose={() => setMostrarAdminCatalogo(false)}
        categoriasProducto={categoriasParaProducto}
        productos={productos}
        marqueeText={textoMarqueeLed}
        onCatalogoActualizado={cargarProductos}
        onSiteConfigActualizado={refrescarSitio}
      />
      
      <a href="https://wa.me/5493515416836" target="_blank" rel="noopener noreferrer" className="fixed bottom-6 left-6 bg-[#25d366] text-white p-4 rounded-full shadow-2xl z-[100] hover:scale-110 transition-transform">
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>
    </main>
  );
}