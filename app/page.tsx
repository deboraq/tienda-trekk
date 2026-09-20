"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getDb, getFirebaseAuth } from "./firebase/config";
import {
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { onAuthStateChanged, type User } from "firebase/auth";
import { FirebaseError } from "firebase/app";
import confetti from "canvas-confetti";
import type { Product, CartItem } from "./types";
import { AdminTiendaPanel } from "./components/AdminTiendaPanel";
import { CuentaClientePanel } from "./components/CuentaClientePanel";
import { StoreHeader } from "./components/storefront/StoreHeader";
import { HomeLanding } from "./components/storefront/HomeLanding";
import { StoreFooter } from "./components/storefront/StoreFooter";
import { BottomNav } from "./components/storefront/BottomNav";
import { CartDrawer } from "./components/storefront/CartDrawer";
import { CatalogView } from "./components/storefront/CatalogView";
import { IconWhatsApp } from "./components/storefront/Icons";
import {
  crearPedidoDesdeCarrito,
  docDataAPedido,
  pedidoTieneConfirmacionPendienteCliente,
} from "./lib/pedidos";
import {
  WHATSAPP_NUMERO_TIENDA,
  normalizarTelefonoWa,
  urlWhatsAppTiendaConsultaGeneral,
} from "./lib/whatsapp";
import {
  cargarConfigSitio,
  CATEGORIAS_DEFAULT_SIN_TODOS,
  TEXTO_LED_DEFAULT,
} from "./lib/site-config";
import { esCatalogAdminEmail } from "./lib/catalog-admin";
import {
  puedeAgregarUnidad,
  productoSinStock,
  stockDesdeFirestore,
} from "./lib/product-stock";
import {
  PRODUCTOS_CAMPANA,
  brand,
  esProductoCampana,
  resolverCategoriaCatalogo,
  type NavClave,
  type VistaTienda,
} from "./lib/brand";

function productoDesdeFirestoreDoc(docSnap: QueryDocumentSnapshot): Product {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    name: d.name ?? "",
    description: d.description,
    price: Number(d.price) ?? 0,
    image: d.image ?? "",
    category: d.category,
    stock: stockDesdeFirestore(d.stock),
  };
}

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
  const [vista, setVista] = useState<VistaTienda>("inicio");
  const [faqAbierto, setFaqAbierto] = useState<number | null>(null);
  const [imagenAmpliada, setImagenAmpliada] = useState<{ src: string; alt: string } | null>(null);
  const [mostrarFaqModal, setMostrarFaqModal] = useState(false);
  const [mostrarAdminCatalogo, setMostrarAdminCatalogo] = useState(false);
  const [mostrarCuentaCliente, setMostrarCuentaCliente] = useState(false);
  const [usuarioTienda, setUsuarioTienda] = useState<User | null>(null);
  const [finalizandoPedido, setFinalizandoPedido] = useState(false);
  const [avisoCheckout, setAvisoCheckout] = useState<string | null>(null);
  const [avisoCarrito, setAvisoCarrito] = useState<string | null>(null);
  const [telefonoCheckout, setTelefonoCheckout] = useState("");
  const [notifMiCuenta, setNotifMiCuenta] = useState(0);
  const [favoritos, setFavoritos] = useState<string[]>([]);
  const inputBusquedaCatalogRef = useRef<HTMLInputElement>(null);
  const inputBusquedaHeaderRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sn_favoritos");
      if (raw) setFavoritos(JSON.parse(raw) as string[]);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleFavorito = useCallback((id: string) => {
    setFavoritos((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      try {
        localStorage.setItem("sn_favoritos", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const cargarProductos = useCallback(async (): Promise<Product[]> => {
    try {
      setErrorFirebase(null);
      const querySnapshot = await getDocs(collection(getDb(), "productos"));
      const docs: Product[] = querySnapshot.docs.map(productoDesdeFirestoreDoc);
      setProductos(docs);
      return docs;
    } catch (error) {
      const permiso =
        error instanceof FirebaseError && error.code === "permission-denied";
      setErrorFirebase(
        permiso
          ? "Firebase bloqueó la lectura del catálogo (permisos). En la consola de Firebase → Firestore → Reglas, permití lectura pública de la colección «productos»."
          : "No pudimos cargar los productos. Revisá tu conexión e intentá de nuevo."
      );
      console.error("Error trayendo productos de Firebase:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    const col = collection(getDb(), "productos");
    const unsub = onSnapshot(
      col,
      (snapshot) => {
        setProductos(snapshot.docs.map(productoDesdeFirestoreDoc));
        setLoading(false);
        setErrorFirebase(null);
      },
      (error) => {
        const permiso =
          error instanceof FirebaseError && error.code === "permission-denied";
        setErrorFirebase(
          permiso
            ? "Firebase bloqueó la lectura del catálogo (permisos). En la consola de Firebase → Firestore → Reglas, permití lectura pública de la colección «productos»."
            : "No pudimos mantener el catálogo actualizado. Revisá tu conexión."
        );
        console.error("Error en escucha de productos:", error);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    setCarrito((prev) => {
      let changed = false;
      const next = prev
        .map((item) => {
          if (esProductoCampana(item.product.id)) return item;
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
    if (!usuarioTienda) {
      setNotifMiCuenta(0);
      return;
    }
    const q = query(
      collection(getDb(), "pedidos"),
      where("userId", "==", usuarioTienda.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        let n = 0;
        snap.forEach((d) => {
          const p = docDataAPedido(d.id, d.data() as Record<string, unknown>);
          if (p && pedidoTieneConfirmacionPendienteCliente(p)) n++;
        });
        setNotifMiCuenta(n);
      },
      (err) => {
        console.error("Pedidos usuario (notificaciones):", err);
        setNotifMiCuenta(0);
      }
    );
    return () => unsub();
  }, [usuarioTienda]);

  useEffect(() => {
    try {
      const g = localStorage.getItem("sn_wa_checkout");
      if (g) setTelefonoCheckout(g);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (vista === "catalogo" && busqueda.trim()) {
      const t = setTimeout(() => inputBusquedaCatalogRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [vista, busqueda]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputBusquedaHeaderRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const irAlInicio = useCallback(() => {
    setVista("inicio");
    setMostrarResumen(false);
    window.setTimeout(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }, 80);
  }, []);

  const abrirCatalogo = useCallback(
    (hint?: string) => {
      const cat = hint
        ? resolverCategoriaCatalogo(hint, categoriasMenu)
        : "Todos";
      setCategoriaSeleccionada(cat);
      setVista("catalogo");
      window.setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 40);
    },
    [categoriasMenu]
  );

  const onNav = useCallback(
    (id: NavClave) => {
      if (id === "inicio") {
        irAlInicio();
        return;
      }
      if (id === "catalogo") {
        abrirCatalogo();
        return;
      }
      if (id === "indumentaria") {
        abrirCatalogo("Camperas e impermeables");
        return;
      }
      if (id === "calzado") {
        abrirCatalogo("Calzado");
        return;
      }
      if (id === "equipo") {
        abrirCatalogo("Accesorios");
        return;
      }
      irAlInicio();
      window.setTimeout(() => {
        document.getElementById("nosotros")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    },
    [abrirCatalogo, irAlInicio]
  );

  const onBusqueda = (value: string) => {
    setBusqueda(value);
    if (value.trim()) setVista("catalogo");
  };

  const productosFiltrados = productos.filter((p) => {
    const name = p.name?.toLowerCase() ?? "";
    const desc = (p.description ?? "").toLowerCase();
    const coincideBusqueda =
      name.includes(busqueda.toLowerCase()) || desc.includes(busqueda.toLowerCase());
    const coincideCategoria =
      categoriaSeleccionada === "Todos" || p.category === categoriaSeleccionada;
    return coincideBusqueda && coincideCategoria;
  });

  const catalogoPorId = new Map(productos.map((p) => [p.id, p]));
  const campanaPorId = new Map(PRODUCTOS_CAMPANA.map((p) => [p.id, p]));
  const productosFavoritos: Product[] = favoritos
    .map((id) => catalogoPorId.get(id) ?? campanaPorId.get(id))
    .filter((p): p is Product => Boolean(p));

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
      particleCount: 50,
      spread: 70,
      origin: { x: 0.5, y: 0.7 },
      colors: [brand.accent, brand.accent2, "#151311"],
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

    const pestañaWa = window.open("about:blank", "_blank");
    setAvisoCheckout(null);
    setFinalizandoPedido(true);

    try {
      const frescos = await cargarProductos();
      const hayCatalogo = carrito.some((i) => !esProductoCampana(i.product.id));
      if (hayCatalogo && frescos.length === 0) {
        pestañaWa?.close();
        setAvisoCheckout(
          "No pudimos comprobar el stock actual. Revisá tu conexión e intentá de nuevo."
        );
        return;
      }

      const carritoAjustado: CartItem[] = carrito
        .map((item) => {
          if (esProductoCampana(item.product.id)) return item;
          const p = frescos.find((pr) => pr.id === item.product.id) ?? item.product;
          let qty = item.quantity;
          if (typeof p.stock === "number" && qty > p.stock) qty = p.stock;
          return { product: p, quantity: qty };
        })
        .filter((i) => i.quantity > 0);

      if (carritoAjustado.length === 0) {
        pestañaWa?.close();
        setCarrito([]);
        setAvisoCheckout(
          "Ya no hay stock disponible para lo que tenías en el carrito. Actualizamos el carrito."
        );
        return;
      }

      const huboRecorte =
        carritoAjustado.length !== carrito.length ||
        carrito.some((c) => {
          const a = carritoAjustado.find((x) => x.product.id === c.product.id);
          return !a || a.quantity !== c.quantity;
        });
      if (huboRecorte) {
        setCarrito(carritoAjustado);
        pestañaWa?.close();
        setAvisoCheckout(
          "Ajustamos las cantidades al stock que queda disponible. Revisá el carrito y volvé a enviar."
        );
        return;
      }

      const totalAjustado = carritoAjustado.reduce(
        (acc, item) => acc + item.product.price * item.quantity,
        0
      );

      const listaProductos = carritoAjustado
        .map(
          (item) =>
            `- ${item.product.name} x${item.quantity} ($${item.product.price * item.quantity})`
        )
        .join("\n");

      let refPedido = "";
      const u = getFirebaseAuth().currentUser;
      const paraFirestore = carritoAjustado.filter((i) => !esProductoCampana(i.product.id));
      if (u && paraFirestore.length > 0) {
        try {
          const totalFirestore = paraFirestore.reduce(
            (acc, item) => acc + item.product.price * item.quantity,
            0
          );
          refPedido = await crearPedidoDesdeCarrito(
            u,
            paraFirestore,
            totalFirestore,
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
          const msg =
            e instanceof Error && e.message ? ` ${e.message}` : "";
          setAvisoCheckout(
            `No pudimos guardar el pedido en tu cuenta.${msg}${detalleReglas} Podés abrir WhatsApp igual con el enlace de abajo.`
          );
        }
      } else {
        setCarrito([]);
      }

      const refBloque = refPedido
        ? `\n\n*Referencia web (seguimiento en Mi cuenta):*\n${refPedido}`
        : "";
      const contactoBloque = `\n\n*Mi WhatsApp:*\n+${telNorm}`;
      const mensaje =
        `¡Hola! Quiero realizar un pedido en *Sangre Nómade*:\n\n${listaProductos}\n\n*Total: $${totalAjustado}*${refBloque}${contactoBloque}\n\n¿Cómo coordinamos el pago?`;
      const urlWa = `https://wa.me/${WHATSAPP_NUMERO_TIENDA}?text=${encodeURIComponent(mensaje)}`;

      if (pestañaWa) {
        pestañaWa.location.href = urlWa;
      } else {
        window.location.href = urlWa;
      }
    } finally {
      setFinalizandoPedido(false);
    }
  };

  const abrirWhatsAppAsesoramiento = () => {
    window.open(urlWhatsAppTiendaConsultaGeneral(), "_blank", "noopener,noreferrer");
  };

  return (
    <main className="min-h-screen bg-[#151311] pb-20 font-sans text-[#D1D5DB] md:pb-0">
      <StoreHeader
        vista={vista}
        busqueda={busqueda}
        onBusqueda={onBusqueda}
        searchRef={inputBusquedaHeaderRef}
        totalItems={totalItems}
        notifMiCuenta={notifMiCuenta}
        usuarioTienda={usuarioTienda}
        onNav={onNav}
        onCart={() => setMostrarResumen((v) => !v)}
        onAccount={() => setMostrarCuentaCliente(true)}
        onWhatsApp={abrirWhatsAppAsesoramiento}
        onHelp={() => setMostrarFaqModal(true)}
        onFavoritos={() => setVista("favoritos")}
      />

      <CartDrawer
        open={mostrarResumen}
        carrito={carrito}
        totalPrecio={totalPrecio}
        telefonoCheckout={telefonoCheckout}
        setTelefonoCheckout={setTelefonoCheckout}
        avisoCheckout={avisoCheckout}
        usuarioTienda={Boolean(usuarioTienda)}
        finalizandoPedido={finalizandoPedido}
        onClose={() => {
          setMostrarResumen(false);
          setAvisoCheckout(null);
        }}
        onCantidad={cambiarCantidad}
        onEliminar={eliminarDelCarrito}
        onFinalizar={() => void finalizarPedido()}
      />

      {avisoCarrito && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-[225] max-w-sm -translate-x-1/2 rounded-lg border border-white/10 bg-[#1D1B19] px-4 py-3 text-center text-sm text-white shadow-2xl md:bottom-10"
        >
          {avisoCarrito}
        </div>
      )}

      {imagenAmpliada && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-4"
          onClick={() => setImagenAmpliada(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Imagen ampliada"
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-[210] flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-800 shadow-lg"
            onClick={(e) => {
              e.stopPropagation();
              setImagenAmpliada(null);
            }}
            aria-label="Cerrar imagen"
          >
            ✕
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imagenAmpliada.src}
            alt={imagenAmpliada.alt}
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {vista === "inicio" && (
        <HomeLanding
          onCatalogo={abrirCatalogo}
          onWhatsApp={abrirWhatsAppAsesoramiento}
          onAdd={agregarAlCarrito}
          favoritos={favoritos}
          onToggleFavorito={toggleFavorito}
        />
      )}

      {vista === "catalogo" && (
        <CatalogView
          titulo="Catálogo técnico"
          categorias={categoriasMenu}
          categoriaSeleccionada={categoriaSeleccionada}
          setCategoria={setCategoriaSeleccionada}
          busqueda={busqueda}
          setBusqueda={setBusqueda}
          searchRef={inputBusquedaCatalogRef}
          productos={productosFiltrados}
          carritoQty={(id) => carrito.find((i) => i.product.id === id)?.quantity ?? 0}
          onAdd={agregarAlCarrito}
          onAmpliar={(src, alt) => setImagenAmpliada({ src, alt })}
          favoritos={favoritos}
          onToggleFavorito={toggleFavorito}
          loading={loading}
          error={errorFirebase}
          onRetry={() => {
            setLoading(true);
            void cargarProductos();
          }}
        />
      )}

      {vista === "favoritos" &&
        (productosFavoritos.length === 0 ? (
          <section className="mx-auto min-h-[50vh] max-w-7xl px-4 py-16 text-center">
            <h1 className="font-heading text-4xl font-bold uppercase tracking-wide text-white">
              Favoritos
            </h1>
            <p className="mx-auto mt-4 max-w-md text-sm text-white/55">
              Todavía no marcaste equipo. El corazón en las cards guarda acá tus piezas de
              campaña.
            </p>
            <button
              type="button"
              onClick={irAlInicio}
              className="mt-6 rounded-md bg-[#E2781E] px-5 py-2.5 font-heading text-sm font-bold uppercase tracking-wide text-black"
            >
              Volver al inicio
            </button>
          </section>
        ) : (
          <CatalogView
            titulo="Favoritos"
            categorias={["Todos"]}
            categoriaSeleccionada="Todos"
            setCategoria={() => undefined}
            busqueda=""
            setBusqueda={() => undefined}
            productos={productosFavoritos}
            carritoQty={(id) => carrito.find((i) => i.product.id === id)?.quantity ?? 0}
            onAdd={agregarAlCarrito}
            onAmpliar={(src, alt) => setImagenAmpliada({ src, alt })}
            favoritos={favoritos}
            onToggleFavorito={toggleFavorito}
          />
        ))}

      <StoreFooter
        onCatalogo={abrirCatalogo}
        onHelp={() => setMostrarFaqModal(true)}
        mostrarAdmin={!usuarioTienda || esCatalogAdminEmail(usuarioTienda.email)}
        onAdmin={() => setMostrarAdminCatalogo(true)}
      />

      {mostrarFaqModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setMostrarFaqModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="faq-modal-title"
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-white/10 bg-[#1D1B19] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/8 p-5">
              <h3 id="faq-modal-title" className="font-heading text-xl font-bold uppercase tracking-wide text-white">
                Centro de ayuda
              </h3>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-md bg-white/5 text-white/70"
                onClick={() => setMostrarFaqModal(false)}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto p-5">
              {[
                {
                  id: 0,
                  pregunta: "¿Cómo comprar?",
                  respuesta:
                    "Elegí del equipamiento, agregá al carrito y enviá el pedido por WhatsApp para coordinar pago y envío a todo el país. Si iniciás sesión antes de enviar, el pedido queda registrado en «Mi cuenta».",
                },
                {
                  id: 1,
                  pregunta: "Envíos y 10% OFF",
                  respuesta:
                    "Enviamos a todo el país. 10% de ahorro vía transferencia o hasta 6 cuotas sin interés. Los tiempos te los confirmamos al cerrar el pedido.",
                },
                {
                  id: 2,
                  pregunta: "Asesoramiento técnico",
                  respuesta:
                    "Escribinos por WhatsApp para talles, capas según el clima o equipo para tu ruta. Atención en vivo por guías de montaña.",
                },
              ].map((faq) => (
                <div key={faq.id} className="overflow-hidden rounded-md border border-white/8 bg-[#151311]">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left font-heading text-sm font-bold uppercase tracking-wide text-white"
                    onClick={() => setFaqAbierto(faqAbierto === faq.id ? null : faq.id)}
                    aria-expanded={faqAbierto === faq.id}
                  >
                    {faq.pregunta}
                    <span className="text-[#E2781E]">{faqAbierto === faq.id ? "−" : "+"}</span>
                  </button>
                  {faqAbierto === faq.id && (
                    <div className="border-t border-white/8 px-4 pb-3 pt-2 text-sm text-[#D1D5DB]">
                      {faq.respuesta}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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

      <a
        href={urlWhatsAppTiendaConsultaGeneral()}
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-24 right-4 z-50 rounded-full bg-[#25d366] p-3.5 text-white shadow-2xl md:hidden"
        aria-label="Contactar por WhatsApp"
      >
        <IconWhatsApp className="h-7 w-7" />
      </a>

      <BottomNav
        vista={vista}
        totalItems={totalItems}
        notifMiCuenta={notifMiCuenta}
        onInicio={irAlInicio}
        onCatalogo={() => abrirCatalogo()}
        onFavoritos={() => setVista("favoritos")}
        onCart={() => setMostrarResumen((v) => !v)}
        onAccount={() => setMostrarCuentaCliente(true)}
      />
    </main>
  );
}
