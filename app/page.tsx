"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { getDb } from "./firebase/config";
import { collection, getDocs } from "firebase/firestore";
import { FirebaseError } from "firebase/app";
import confetti from "canvas-confetti";
import type { Product, CartItem } from "./types";

const NUMERO_WHATSAPP = "5493515416836";

const TEXTO_LED_MARQUEE =
  "EQUIPO TÉCNICO MULTIMARCAS PARA SENDERISTAS Y MONTAÑISTAS";

const SEGMENTOS_LED_MARQUEE = 6;

/** Paleta oficial Sangre Nómade Adventure (logo) */
const brand = {
  primary: "#2F3E46",
  accent: "#A65D37",
  forest: "#53634B",
  forestDark: "#3d4a38",
  cream: "#F2EBD3",
};

const categorias = [
  "Todos",
  "Calzado",
  "Camperas e impermeables",
  "Mochilas",
  "Accesorios",
  "Térmico",
  "Pack aventura",
];

export default function Home() {
  const [productos, setProductos] = useState<Product[]>([]);
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
  const inputBusquedaCatalogRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchProductos = async () => {
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
    };
    fetchProductos();
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
    setCarrito((prev) =>
      prev
        .map((i) =>
          i.product.id === productId
            ? { ...i, quantity: Math.max(0, i.quantity + delta) }
            : i
        )
        .filter((i) => i.quantity > 0)
    );
  };

  const totalPrecio = carrito.reduce(
    (acc, item) => acc + item.product.price * item.quantity,
    0
  );
  const totalItems = carrito.reduce((acc, item) => acc + item.quantity, 0);

  const finalizarPedido = () => {
    if (carrito.length === 0) return;
    const listaProductos = carrito
      .map(
        (item) =>
          `- ${item.product.name} x${item.quantity} ($${item.product.price * item.quantity})`
      )
      .join("%0A");
    const mensaje = `¡Hola! Quiero realizar un pedido en *Sangre Nómade Adventure*:%0A%0A${listaProductos}%0A%0A*Total: $${totalPrecio}*%0A%0A¿Cómo coordinamos el pago?`;
    window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${mensaje}`, "_blank");
  };

  const abrirWhatsAppAsesoramiento = () => {
    const mensaje =
      "¡Hola! Me interesa *asesoramiento* sobre equipo de trekking (talles, disponibilidad o una salida puntual).";
    window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`, "_blank");
  };

  return (
    <main className="min-h-screen pb-20 font-sans text-[#2F3E46]" style={{ backgroundColor: brand.cream }}>
      
      {/* --- NAVBAR --- */}
      <nav className="text-white py-3 px-4 shadow-md sticky top-0 z-50 border-b-2 border-[#2F3E46]/30" style={{ backgroundColor: brand.primary }}>
        <div className="max-w-7xl mx-auto relative flex flex-wrap items-center justify-between gap-3">
          {/* Logo (izquierda) */}
          <div className="flex items-center gap-3 shrink-0 z-10">
            <button
              onClick={() => { setVerTienda(false); setMenuMovilAbierto(false); }}
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

          {/* Enlaces al centro (solo escritorio) - centrado real en la pantalla */}
          <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="flex gap-6 text-sm md:text-base uppercase tracking-widest font-medium font-heading">
              <button onClick={() => setVerTienda(false)} className="hover:text-[#e8c9a8] uppercase transition-colors">Inicio</button>
              <a href="#nosotros" onClick={() => setVerTienda(false)} className="hover:text-[#e8c9a8] transition-colors uppercase">Nosotros</a>
              <a href="#rutas-guias" onClick={() => setVerTienda(false)} className="hover:text-[#e8c9a8] transition-colors uppercase">Rutas y guías</a>
              <div className="relative">
                <button
                  onClick={() => setMostrarCategorias(!mostrarCategorias)}
                  className="hover:text-[#e8c9a8] transition-colors flex items-center gap-1 uppercase tracking-widest outline-none"
                >
                  Equipamiento {mostrarCategorias ? "▴" : "▾"}
                </button>
                {mostrarCategorias && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-[min(100vw-2rem,18rem)] max-h-[70vh] overflow-y-auto bg-[#F2EBD3] rounded-xl shadow-2xl border-2 border-[#2F3E46]/20 overflow-x-hidden z-50 text-[#2F3E46] normal-case tracking-normal font-sans">
                    {categorias.map((cat) => (
                      <button
                        key={cat}
                        className={`w-full text-left px-5 py-3 text-sm hover:bg-[#A65D37]/15 transition-colors ${categoriaSeleccionada === cat ? "bg-[#53634B]/15 font-bold text-[#53634B]" : ""}`}
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
              <a href="#contacto" className="hover:text-[#e8c9a8] transition-colors">Contacto</a>
            </div>
          </div>

          {/* Derecha: carrito y buscador con la misma altura */}
          <div className="flex flex-col items-end gap-1.5 shrink-0 z-10">
            <button
              onClick={() => setMostrarResumen(!mostrarResumen)}
              className="bg-white px-4 h-10 rounded-full font-bold shadow-md text-sm active:scale-95 transition-all w-fit flex items-center justify-center border-2 border-[#2F3E46]/10"
              style={{ color: brand.forest }}
              aria-label={`Tu carrito tiene ${totalItems} producto(s)`}
            >
              🛒 Tu Carrito ({totalItems})
            </button>
            {!verTienda && (
              <div className="hidden md:block w-44 lg:w-52">
                <div className="relative h-10">
                  <span className="absolute inset-y-0 left-3 flex items-center text-white/70 pointer-events-none text-sm">🔍</span>
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => {
                      setBusqueda(e.target.value);
                      if (e.target.value.trim()) setVerTienda(true);
                    }}
                    placeholder="Buscar equipamiento..."
                    className="w-full h-10 pl-9 pr-8 rounded-full border border-white/25 bg-white/15 text-white placeholder-white/60 text-sm outline-none focus:bg-white/25 focus:border-white/40 focus:ring-1 focus:ring-white/30 transition-colors"
                    aria-label="Buscar productos"
                  />
                  {busqueda && (
                    <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-1 transition-colors" onClick={() => setBusqueda("")} aria-label="Borrar búsqueda">✕</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Menú móvil: buscador solo en pantalla principal */}
        {menuMovilAbierto && (
          <div className="md:hidden mt-4 pt-4 border-t border-white/20 flex flex-col gap-2 text-sm uppercase tracking-widest">
            {!verTienda && (
              <div className="relative mb-2">
                <span className="absolute inset-y-0 left-3 flex items-center text-white/70 pointer-events-none text-sm">🔍</span>
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    if (e.target.value.trim()) setVerTienda(true);
                  }}
                  placeholder="Buscar equipamiento..."
                  className="w-full pl-9 pr-8 py-2.5 rounded-full border border-white/25 bg-white/15 text-white placeholder-white/60 text-sm normal-case outline-none focus:bg-white/25 focus:border-white/40"
                  aria-label="Buscar productos"
                />
                {busqueda && (
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-1" onClick={() => setBusqueda("")} aria-label="Borrar">✕</button>
                )}
              </div>
            )}
            <button onClick={() => { setVerTienda(false); setMenuMovilAbierto(false); }} className="text-left py-2 hover:text-[#e8c9a8]">Inicio</button>
            <a href="#nosotros" onClick={() => setMenuMovilAbierto(false)} className="py-2 hover:text-[#e8c9a8]">Nosotros</a>
            <a href="#rutas-guias" onClick={() => setMenuMovilAbierto(false)} className="block py-2 hover:text-[#e8c9a8]">Rutas y guías</a>
            <button onClick={() => { setVerTienda(true); setCategoriaSeleccionada("Todos"); setMenuMovilAbierto(false); }} className="text-left py-2 hover:text-[#e8c9a8]">Ver equipamiento</button>
            <a href="#contacto" onClick={() => setMenuMovilAbierto(false)} className="py-2 hover:text-[#e8c9a8]">Contacto</a>
            <div className="pt-2 border-t border-white/20">
              <p className="text-xs normal-case opacity-80 mb-2">Productos por categoría</p>
              <div className="flex flex-wrap gap-2">
                {categorias.filter((c) => c !== "Todos").map((cat) => (
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
        <div className="fixed inset-x-4 top-20 md:left-auto md:right-6 md:w-80 bg-white shadow-2xl rounded-2xl p-6 z-[60] border border-gray-100 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex justify-between items-center mb-4 border-b pb-2 font-bold text-lg">
            <span>Tu Pedido</span>
            <button onClick={() => setMostrarResumen(false)} className="text-gray-400 p-1" aria-label="Cerrar carrito">✕</button>
          </div>
          <div className="max-h-60 overflow-y-auto mb-4 space-y-3">
            {carrito.length === 0 ? (
              <p className="text-gray-500 text-sm py-4 text-center">Tu carrito está vacío</p>
            ) : (
              carrito.map((item) => (
                <div key={item.product.id} className="flex justify-between items-start text-sm border-b pb-2 gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium block">{item.product.name}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        type="button"
                        className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100 font-bold"
                        onClick={() => cambiarCantidad(item.product.id, -1)}
                        aria-label="Restar uno"
                      >
                        −
                      </button>
                      <span className="font-bold w-6 text-center">{item.quantity}</span>
                      <button
                        type="button"
                        className="w-7 h-7 rounded border border-gray-200 flex items-center justify-center hover:bg-gray-100 font-bold"
                        onClick={() => cambiarCantidad(item.product.id, 1)}
                        aria-label="Sumar uno"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-bold">${(item.product.price * item.quantity).toLocaleString("es-AR")}</span>
                    <button onClick={() => eliminarDelCarrito(item.product.id)} className="p-1 hover:bg-gray-100 rounded" aria-label="Quitar del carrito">🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>
          {carrito.length > 0 && (
            <>
              <div className="text-xl font-black text-[#53634B] mb-4">TOTAL: ${totalPrecio.toLocaleString("es-AR")}</div>
              <button onClick={finalizarPedido} className="w-full bg-[#53634B] text-white py-4 rounded-xl font-bold hover:bg-[#3d4a38] transition-colors">Enviar WhatsApp</button>
            </>
          )}
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
            onClick={() => { setLoading(true); setErrorFirebase(null); window.location.reload(); }}
            className="bg-[#53634B] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#3d4a38] transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : !verTienda ? (
        <>
          <div
            className="border-b border-zinc-800 bg-[#0a0a0a] py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
            role="region"
            aria-label="Equipo técnico multimarcas para senderistas y montañistas"
          >
            <div className="overflow-hidden">
              <div
                className="sn-marquee-track sn-marquee-led-text flex w-max font-mono text-xs font-medium uppercase leading-snug tracking-[0.08em] text-[#a7f3d0] sm:text-sm"
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
                    {TEXTO_LED_MARQUEE}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <section className="border-y border-[#A65D37]/30 bg-[#ddd0bc] py-12 text-center">
            <h3 className="mb-2 font-heading text-2xl font-bold uppercase tracking-wide text-[#2F3E46]">Tu próxima cima</h3>
            <p className="text-[#2F3E46]/80 px-4 max-w-lg mx-auto">
              No vendemos solo una bota: te acercamos a la cima que esa bota permite alcanzar. Consultá talles, stock o el kit según tu ruta — fin de semana o técnica
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
              {productosDestacados.map((producto) => (
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
                    <Image src={producto.image} alt={producto.name} fill className="object-cover pointer-events-none" sizes="(max-width:768px) 100vw, 33vw" unoptimized />
                    <span className="absolute inset-0 flex items-end justify-center pb-2 text-white text-sm font-medium bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity">Ver más grande</span>
                  </div>
                  <h4 className="text-xl font-bold">{producto.name}</h4>
                  <p className="text-2xl font-black text-[#53634B] my-4">${(producto.price ?? 0).toLocaleString("es-AR")}</p>
                  <button onClick={() => agregarAlCarrito(producto)} className="w-full bg-[#53634B] text-white py-2 rounded-xl font-bold active:scale-95 transition-all">Agregar al Carrito</button>
                </div>
              ))}
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
                En Sangre Nómade somos eseller multimarcas: seleccionamos calzado, capas y accesorios de referencias como Columbia, Ansilta, Lippi o Doite, con el criterio de quien prueba en terreno. Valientes, auténticos y conectados con la naturaleza — desde Córdoba, para quien camina para encontrarse.
              </p>
            </div>
          </section>
        </>
      ) : (
        <section id="productos" className="max-w-6xl mx-auto p-4 pt-16 min-h-screen">
          <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-4">
            <button onClick={() => setVerTienda(false)} className="text-[#53634B] font-bold flex items-center gap-2 hover:underline shrink-0">
              <span>←</span> Volver al inicio
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
                  <Image src={producto.image} alt={producto.name} fill className="object-cover pointer-events-none" sizes="(max-width:768px) 100vw, 33vw" unoptimized />
                  <span className="absolute inset-0 flex items-end justify-center pb-2 text-white text-sm font-medium bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity">Ver más grande</span>
                </div>
                <div className="p-6 text-center flex-grow flex flex-col justify-between">
                  <div>
                    <h4 className="text-xl font-bold mb-2">{producto.name}</h4>
                    <p className="text-gray-500 text-sm mb-4">{producto.description}</p>
                    <p className="text-3xl font-black text-[#53634B] mb-6">${(producto.price ?? 0).toLocaleString("es-AR")}</p>
                  </div>
                  <button onClick={() => agregarAlCarrito(producto)} className="w-full bg-[#53634B] text-white py-3 rounded-2xl font-bold shadow-md active:scale-95 transition-all">Agregar al Carrito</button>
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

      {/* Botón para abrir Preguntas Frecuentes en ventana aparte */}
      <section className="max-w-4xl mx-auto py-12 px-6 text-center">
        <button
          type="button"
          onClick={() => setMostrarFaqModal(true)}
          className="bg-[#F2EBD3] hover:bg-[#e8e0c8] font-bold text-lg px-6 py-3 rounded-full border-2 border-[#2F3E46]/25 focus:outline-none focus:ring-2 focus:ring-[#53634B] focus:ring-offset-2 transition-colors font-heading uppercase tracking-wide text-sm"
          style={{ color: brand.forest }}
        >
          ❓ Preguntas Frecuentes
        </button>
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
                    "Elegí del equipamiento, agregá al carrito y enviá el pedido por WhatsApp para coordinar pago y envío a todo el país.",
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

      {/* SEO local / contenido futuro: rutas y guías */}
      <section
        id="rutas-guias"
        className="max-w-5xl mx-auto px-6 py-16 border-t-2 border-[#2F3E46]/15"
      >
        <div className="rounded-3xl border-2 border-[#2F3E46]/25 bg-white/80 p-8 md:p-12 shadow-sm">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div
              className="shrink-0 w-20 h-20 rounded-full border-2 border-[#2F3E46]/30 flex items-center justify-center bg-[#F2EBD3]"
              aria-hidden
            >
              <svg viewBox="0 0 64 64" className="w-12 h-12 text-[#A65D37]" fill="currentColor">
                <path d="M32 4L36 24h8L38 32l6 20-12-12-12 12 6-20-6-8h8z" opacity="0.35" />
                <path d="M32 8l3 14h-6L32 8zm0 22v30M32 12l-4 18h8L32 12z" fill="#2F3E46" />
                <circle cx="32" cy="32" r="28" fill="none" stroke="#2F3E46" strokeWidth="2" opacity="0.4" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-heading font-bold uppercase tracking-wide text-[#2F3E46] mb-3">
                Rutas y guías
              </h2>
              <p className="text-[#2F3E46]/85 leading-relaxed mb-4">
                Estamos armando contenido para posicionarnos en búsquedas locales: calzado para El Chaltén, qué llevar en la mochila para Torres del Paine, capas para clima patagónico y más. En el trekking digital no vendemos solo un producto: vendemos la cima que ese equipo te permite alcanzar.
              </p>
              <ul className="text-sm text-[#53634B] space-y-2 list-none">
                <li className="flex gap-2">
                  <span className="text-[#A65D37]" aria-hidden>
                    ★
                  </span>
                  Próximas publicaciones: guías por destino y comparativas multimarcas.
                </li>
                <li className="flex gap-2">
                  <span className="text-[#A65D37]" aria-hidden>
                    ★
                  </span>
                  Si tenés una ruta en mente, pedinos tema por WhatsApp y lo sumamos a la lista.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

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
          <div>
            <h4 className="font-bold mb-4 text-xl text-[#2F3E46] font-heading uppercase tracking-wide text-lg">Sangre Nómade Adventure</h4>
            <p className="text-gray-500 text-sm">© 2026 - Córdoba, Argentina.</p>
          </div>
        </div>
      </footer>
      
      <a href="https://wa.me/5493515416836" target="_blank" rel="noopener noreferrer" className="fixed bottom-6 left-6 bg-[#25d366] text-white p-4 rounded-full shadow-2xl z-[100] hover:scale-110 transition-transform">
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </a>
    </main>
  );
}