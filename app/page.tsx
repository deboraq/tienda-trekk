"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getDb } from "./firebase/config";
import { collection, getDocs } from "firebase/firestore";
import confetti from "canvas-confetti";
import type { Product, CartItem } from "./types";

const NUMERO_WHATSAPP = "5493515416836";
const categorias = ["Todos", "Mates", "Termos", "Bombillas", "Yerberas", "Set Materos", "Despolvillador"];

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
        setErrorFirebase("No pudimos cargar los productos. Revisá tu conexión e intentá de nuevo.");
        console.error("Error trayendo productos de Firebase:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProductos();
  }, []);

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
      colors: ["#4a5d23", "#8b4513", "#fdfcf0"],
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
    const mensaje = `¡Hola! Quiero realizar un pedido en *Nómade Mates*:%0A%0A${listaProductos}%0A%0A*Total: $${totalPrecio}*%0A%0A¿Cómo coordinamos el pago?`;
    window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${mensaje}`, "_blank");
  };

  const abrirWhatsAppGrabados = () => {
    const mensaje =
      "¡Hola! Me interesa consultar por *grabados láser* (nombres, logos) en productos de Nómade Mates.";
    window.open(`https://wa.me/${NUMERO_WHATSAPP}?text=${encodeURIComponent(mensaje)}`, "_blank");
  };

  return (
    <main className="min-h-screen bg-[#fdfcf0] pb-20 font-sans text-gray-800">
      
      {/* --- NAVBAR --- */}
      <nav className="bg-[#4a5d23] text-white p-4 shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => { setVerTienda(false); setMenuMovilAbierto(false); }}
              className="text-xl md:text-2xl font-bold font-serif whitespace-nowrap"
            >
              🍂 Nómade Mates
            </button>
            <button
              type="button"
              className="md:hidden p-2 rounded-lg hover:bg-white/10"
              onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}
              aria-expanded={menuMovilAbierto}
              aria-label={menuMovilAbierto ? "Cerrar menú" : "Abrir menú"}
            >
              {menuMovilAbierto ? (
                <span className="text-xl">✕</span>
              ) : (
                <span className="text-xl">☰</span>
              )}
            </button>
          </div>

          <div className="hidden md:flex gap-6 text-xs uppercase tracking-widest font-medium">
            <button onClick={() => setVerTienda(false)} className="hover:text-amber-200 uppercase transition-colors">Inicio</button>
            <a href="#nosotros" onClick={() => setVerTienda(false)} className="hover:text-amber-200 transition-colors uppercase">Nosotros</a>
            <div className="relative">
              <button
                onClick={() => setMostrarCategorias(!mostrarCategorias)}
                className="hover:text-amber-200 transition-colors flex items-center gap-1 uppercase tracking-widest outline-none"
              >
                Productos {mostrarCategorias ? "▴" : "▾"}
              </button>
              {mostrarCategorias && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 text-gray-800 normal-case tracking-normal font-sans">
                  {categorias.map((cat) => (
                    <button
                      key={cat}
                      className={`w-full text-left px-5 py-3 text-sm hover:bg-amber-50 transition-colors ${categoriaSeleccionada === cat ? "bg-amber-100 font-bold text-[#4a5d23]" : ""}`}
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
            <a href="#contacto" className="hover:text-amber-200 transition-colors">Contacto</a>
          </div>

          <div className="hidden md:block flex-1 max-w-xs mx-4">
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">🔍</span>
              <input
                type="search"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  if (e.target.value.trim()) setVerTienda(true);
                }}
                placeholder="Buscar productos..."
                className="w-full pl-9 pr-4 py-2 rounded-full border-0 bg-white/95 text-gray-800 placeholder-gray-500 text-sm outline-none focus:ring-2 focus:ring-amber-300"
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

          <button
            onClick={() => setMostrarResumen(!mostrarResumen)}
            className="bg-white text-[#4a5d23] px-4 py-2 rounded-full font-bold shadow-md text-sm active:scale-95 transition-all shrink-0"
            aria-label={`Tu carrito tiene ${totalItems} producto(s)`}
          >
            🛒 Tu Carrito ({totalItems})
          </button>
        </div>

        {/* Menú móvil */}
        {menuMovilAbierto && (
          <div className="md:hidden mt-4 pt-4 border-t border-white/20 flex flex-col gap-2 text-sm uppercase tracking-widest">
            <div className="relative mb-2">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">🔍</span>
              <input
                type="search"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  if (e.target.value.trim()) setVerTienda(true);
                }}
                placeholder="Buscar productos..."
                className="w-full pl-9 pr-8 py-2.5 rounded-full border-0 bg-white/95 text-gray-800 placeholder-gray-500 text-sm normal-case"
                aria-label="Buscar productos"
              />
              {busqueda && (
                <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 p-1" onClick={() => setBusqueda("")} aria-label="Borrar">✕</button>
              )}
            </div>
            <button onClick={() => { setVerTienda(false); setMenuMovilAbierto(false); }} className="text-left py-2 hover:text-amber-200">Inicio</button>
            <a href="#nosotros" onClick={() => setMenuMovilAbierto(false)} className="py-2 hover:text-amber-200">Nosotros</a>
            <button onClick={() => { setVerTienda(true); setCategoriaSeleccionada("Todos"); setMenuMovilAbierto(false); }} className="text-left py-2 hover:text-amber-200">Ver catálogo</button>
            <a href="#contacto" onClick={() => setMenuMovilAbierto(false)} className="py-2 hover:text-amber-200">Contacto</a>
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
              <div className="text-xl font-black text-[#4a5d23] mb-4">TOTAL: ${totalPrecio.toLocaleString("es-AR")}</div>
              <button onClick={finalizarPedido} className="w-full bg-[#4a5d23] text-white py-4 rounded-xl font-bold hover:bg-[#3a4a1c] transition-colors">Enviar WhatsApp</button>
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#4a5d23]" aria-hidden></div>
          <p className="mt-4 text-gray-500 italic">Cargando mates desde la nube...</p>
        </div>
      ) : errorFirebase ? (
        <div className="flex flex-col items-center justify-center min-h-[20rem] px-6 text-center">
          <p className="text-red-600 font-medium mb-2">{errorFirebase}</p>
          <button
            type="button"
            onClick={() => { setLoading(true); setErrorFirebase(null); window.location.reload(); }}
            className="bg-[#4a5d23] text-white px-6 py-3 rounded-xl font-bold hover:bg-[#3a4a1c] transition-colors"
          >
            Reintentar
          </button>
        </div>
      ) : !verTienda ? (
        <>
          <header className="py-20 text-center bg-white border-b border-gray-100">
            <h2 className="text-6xl md:text-8xl font-bold text-gray-800 mb-4 tracking-tighter">Nómade Mates</h2>
            <p className="text-xl md:text-2xl text-gray-500 italic">"Uniendo rincones, cebando historias"</p>
          </header>

          <section className="bg-amber-50 py-12 text-center border-y border-amber-100">
            <h3 className="text-2xl font-bold mb-2">✨ Personalizá tu producto</h3>
            <p className="text-gray-600 px-4">Grabados láser, nombres y logos. ¡Hacé que tu mate sea único!</p>
            <button onClick={abrirWhatsAppGrabados} className="mt-4 bg-[#8b4513] text-white px-8 py-3 rounded-full font-bold hover:scale-105 transition-transform shadow-md">
              Consultar por grabados
            </button>
          </section>

          <section id="destacados" className="max-w-6xl mx-auto p-4 pt-16 text-center">
            <h3 className="text-3xl font-bold mb-10">🔥 Productos Destacados</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {productosDestacados.map((producto) => (
                <div key={producto.id} className="bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100 p-4 hover:shadow-2xl transition-all">
                  <div
                    role="button"
                    tabIndex={0}
                    className="relative h-48 w-full rounded-2xl mb-4 overflow-hidden bg-gray-100 block w-full cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-[#4a5d23] focus:ring-offset-2"
                    onClick={() => producto.image && setImagenAmpliada({ src: producto.image, alt: producto.name })}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); producto.image && setImagenAmpliada({ src: producto.image, alt: producto.name }); } }}
                    aria-label={`Ver foto ampliada de ${producto.name}`}
                  >
                    <Image src={producto.image} alt={producto.name} fill className="object-cover pointer-events-none" sizes="(max-width:768px) 100vw, 33vw" unoptimized />
                    <span className="absolute inset-0 flex items-end justify-center pb-2 text-white text-sm font-medium bg-gradient-to-t from-black/50 to-transparent opacity-0 hover:opacity-100 transition-opacity">Ver más grande</span>
                  </div>
                  <h4 className="text-xl font-bold">{producto.name}</h4>
                  <p className="text-2xl font-black text-[#4a5d23] my-4">${(producto.price ?? 0).toLocaleString("es-AR")}</p>
                  <button onClick={() => agregarAlCarrito(producto)} className="w-full bg-[#4a5d23] text-white py-2 rounded-xl font-bold active:scale-95 transition-all">Agregar al Carrito</button>
                </div>
              ))}
            </div>
            <button 
              onClick={() => setVerTienda(true)}
              className="mt-12 bg-white border-2 border-[#4a5d23] text-[#4a5d23] px-10 py-4 rounded-full font-bold hover:bg-[#4a5d23] hover:text-white transition-all shadow-lg"
            >
              Ver Catálogo Completo →
            </button>
          </section>

          <section id="nosotros" className="bg-[#4a5d23] text-white py-20 px-6 mt-20">
            <div className="max-w-4xl mx-auto text-center">
              <h3 className="text-4xl font-serif font-bold mb-8">Nuestra Esencia</h3>
              <p className="text-xl md:text-2xl leading-relaxed opacity-90 italic font-light px-4">
                "Somos apasionados de la cultura matera nacidos en Córdoba. En Nómade, creemos que el mate es el único objeto capaz de habitar dos lugares al mismo tiempo: el rincón donde estamos y la historia que estamos construyendo."
              </p>
            </div>
          </section>
        </>
      ) : (
        <section id="productos" className="max-w-6xl mx-auto p-4 pt-16 min-h-screen">
          <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-4">
            <button onClick={() => setVerTienda(false)} className="text-[#4a5d23] font-bold flex items-center gap-2 hover:underline">
              <span>←</span> Volver al inicio
            </button>
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">🔍</span>
              <input 
                type="text" 
                placeholder="Buscar en la tienda..." 
                className="w-full pl-10 pr-4 py-2.5 rounded-full border-2 border-gray-200 outline-none focus:border-[#4a5d23] transition-all"
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
          </div>
          <h3 className="text-4xl font-bold mb-8 text-gray-800">Catálogo: {categoriaSeleccionada}</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
            {productosFiltrados.map((producto) => (
              <div key={producto.id} className="bg-white rounded-3xl overflow-hidden shadow-lg border border-gray-100 flex flex-col hover:shadow-2xl transition-all">
                <div
                  role="button"
                  tabIndex={0}
                  className="relative h-64 bg-gray-50 overflow-hidden block w-full cursor-zoom-in focus:outline-none focus:ring-2 focus:ring-[#4a5d23] focus:ring-offset-2"
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
                    <p className="text-3xl font-black text-[#4a5d23] mb-6">${(producto.price ?? 0).toLocaleString("es-AR")}</p>
                  </div>
                  <button onClick={() => agregarAlCarrito(producto)} className="w-full bg-[#4a5d23] text-white py-3 rounded-2xl font-bold shadow-md active:scale-95 transition-all">Agregar al Carrito</button>
                </div>
              </div>
            ))}
          </div>

          {productosFiltrados.length === 0 && (
            <div className="col-span-full text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
               <p className="text-gray-500 text-xl italic mb-4">No encontramos productos en "{categoriaSeleccionada}".</p>
               <button 
                 onClick={() => {setCategoriaSeleccionada("Todos"); setBusqueda("");}}
                 className="bg-[#4a5d23] text-white px-6 py-2 rounded-full font-bold hover:bg-[#3a4a1c] transition-colors"
               >
                 Ver todos los productos
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
          className="bg-amber-100 hover:bg-amber-200 text-[#4a5d23] font-bold text-lg px-6 py-3 rounded-xl border-2 border-[#4a5d23]/30 focus:outline-none focus:ring-2 focus:ring-[#4a5d23] focus:ring-offset-2 transition-colors"
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
                { id: 0, pregunta: "¿Cómo comprar?", respuesta: "Elegí tus productos, agregalos al carrito y finalizá el pedido por WhatsApp." },
                { id: 1, pregunta: "Envíos", respuesta: "Hacemos envíos a todo el país a través de Correo Argentino." },
              ].map((faq) => (
                <div key={faq.id} className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                  <button
                    type="button"
                    className="w-full text-left px-5 py-4 font-bold text-lg flex justify-between items-center hover:bg-gray-100 transition-colors"
                    onClick={() => setFaqAbierto(faqAbierto === faq.id ? null : faq.id)}
                    aria-expanded={faqAbierto === faq.id}
                  >
                    {faq.pregunta}
                    <span className="text-[#4a5d23] text-xl">{faqAbierto === faq.id ? "−" : "+"}</span>
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
                className="w-full bg-[#4a5d23] text-white py-3 rounded-xl font-bold hover:bg-[#3a4a1c] transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer id="contacto" className="bg-white border-t border-gray-100 py-16 px-6">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
          <div>
            <h4 className="font-bold mb-4 text-xl text-[#4a5d23]">Contacto</h4>
            <p className="text-gray-600">WhatsApp: +54 9 351 541-6836</p>
            <p className="text-gray-600">Email: hola@nomademates.com</p>
          </div>
          <div>
            <h4 className="font-bold mb-4 text-xl text-[#4a5d23]">Redes Sociales</h4>
            <div className="flex justify-center md:justify-start gap-4">
              <a href="https://instagram.com/nomademates" target="_blank" className="bg-gray-100 p-2 rounded-lg hover:bg-amber-100 transition-colors font-medium">Instagram</a>
              <a href="https://facebook.com/nomademates" target="_blank" className="bg-gray-100 p-2 rounded-lg hover:bg-amber-100 transition-colors font-medium">Facebook</a>
            </div>
          </div>
          <div>
            <h4 className="font-bold mb-4 text-xl text-[#4a5d23]">Nómade Mates</h4>
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