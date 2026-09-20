import type { Product } from "../types";

export const brand = {
  bg: "#151311",
  bgWarm: "#151311",
  surface: "#1D1B19",
  surfaceWarm: "#1D1B19",
  header: "#2C2926",
  headerDeep: "#241F1B",
  accent: "#E2781E",
  accent2: "#E68C24",
  accentHover: "#C96614",
  text: "#D1D5DB",
  muted: "#9CA3AF",
  border: "rgba(255, 255, 255, 0.08)",
};

export type VistaTienda = "inicio" | "catalogo" | "favoritos";

export type NavClave =
  | "inicio"
  | "catalogo"
  | "indumentaria"
  | "calzado"
  | "equipo"
  | "nosotros";

export const NAV_DESKTOP: { id: NavClave; label: string }[] = [
  { id: "inicio", label: "INICIO" },
  { id: "catalogo", label: "CATÁLOGO TÉCNICO" },
  { id: "indumentaria", label: "INDUMENTARIA" },
  { id: "calzado", label: "CALZADO" },
  { id: "equipo", label: "EQUIPO & ACCESORIOS" },
  { id: "nosotros", label: "SOBRE NOSOTROS" },
];

export type CategoriaCampana = {
  id: string;
  kicker: string;
  title: string;
  detail: string;
  image: string;
  catalogHint: string;
};

export const CATEGORIAS_CAMPANA: CategoriaCampana[] = [
  {
    id: "camperas",
    kicker: "CAPA 3 · HARDSHELL",
    title: "CAMPERAS & ANORAKS",
    detail: "Membranas impermeables 28K, costuras termoselladas y softshell.",
    image: "/brand/cat-camperas.png",
    catalogHint: "Camperas e impermeables",
  },
  {
    id: "pantalones",
    kicker: "RESISTENCIA AL ROCE",
    title: "PANTALONES TRAIL & TREK",
    detail: "Ripstop 4-way stretch, fuelles ergonómicos y modelos desmontables.",
    image: "/brand/cat-pantalones.png",
    catalogHint: "Pantalones",
  },
  {
    id: "calzado",
    kicker: "TRACCIÓN TOTAL",
    title: "CALZADO & BOTAS",
    detail: "Suelas Vibram® Megagrip, sujeción de tobillo y botín impermeable.",
    image: "/brand/cat-calzado.png",
    catalogHint: "Calzado",
  },
  {
    id: "accesorios",
    kicker: "CARGA & VIVAC",
    title: "EQUIPO & ACCESORIOS",
    detail: "Termos criogénicos 36hs, bastones carbono, yerberos y packs.",
    image: "/brand/cat-equipo.png",
    catalogHint: "Accesorios",
  },
];

export type TabDestacados =
  | "todos"
  | "camperas"
  | "pantalones"
  | "calzado"
  | "accesorios";

export const TABS_DESTACADOS: { id: TabDestacados; label: string }[] = [
  { id: "todos", label: "TODOS" },
  { id: "camperas", label: "CAMPERAS & IMPERMEABLES" },
  { id: "pantalones", label: "PANTALONES" },
  { id: "calzado", label: "CALZADO" },
  { id: "accesorios", label: "ACCESORIOS" },
];

export type ProductoCampana = Product & {
  tab: Exclude<TabDestacados, "todos">;
  badge: string;
  badgeSub: string;
  rating: number;
  reviews: number;
  metaLabel: string;
  metaValue: string;
  specLine: string;
  sizes?: string[];
  defaultSize?: string;
  color?: string;
  priceList?: number;
  cuotas: { n: number; monto: number };
  transferPrice: number;
};

export const PRODUCTOS_CAMPANA: ProductoCampana[] = [
  {
    id: "campana-anorak-cerro-torre",
    name: "Campera Anorak Ripstop 3L Cerro Torre",
    description: "Membrana 3L · Gore-Tex homologado",
    price: 185000,
    priceList: 215000,
    image: "/brand/prod-anorak.png",
    category: "Camperas e impermeables",
    tab: "camperas",
    badge: "SERIE ALPINISMO",
    badgeSub: "28.000 MM",
    rating: 4.9,
    reviews: 42,
    metaLabel: "PESO",
    metaValue: "480G",
    specLine: "MEMBRANA 3L · GORE-TEX HOMOLOGADO",
    sizes: ["S", "M", "L", "XL"],
    defaultSize: "M",
    cuotas: { n: 6, monto: 30833 },
    transferPrice: 166500,
  },
  {
    id: "campana-pantalon-gigantes",
    name: "Pantalón Cargo Desmontable Los Gigantes",
    description: "Ripstop 4-way · Solar UV 50+",
    price: 98000,
    image: "/brand/prod-pantalon.png",
    category: "Pantalones",
    tab: "pantalones",
    badge: "DESMONTABLE 2-EN-1",
    badgeSub: "QUICK-DRY",
    rating: 4.8,
    reviews: 29,
    metaLabel: "PESO",
    metaValue: "340G",
    specLine: "RIPSTOP 4-WAY · SOLAR UV 50+",
    sizes: ["38", "40", "42", "44"],
    defaultSize: "40",
    cuotas: { n: 3, monto: 32666 },
    transferPrice: 88200,
  },
  {
    id: "campana-bota-cordoba",
    name: "Bota Trekking Waterproof Córdoba 3.0",
    description: "Puntera reforzada · Tobillo anatómico",
    price: 210000,
    image: "/brand/prod-bota.png",
    category: "Calzado",
    tab: "calzado",
    badge: "VIBRAM® MEGAGRIP",
    badgeSub: "WATERPROOF DWR",
    rating: 5.0,
    reviews: 58,
    metaLabel: "PESO",
    metaValue: "620G",
    specLine: "PUNTERA REFORZADA · TOBILLO ANATÓMICO",
    sizes: ["41", "42", "43", "44"],
    defaultSize: "42",
    cuotas: { n: 6, monto: 35000 },
    transferPrice: 189000,
  },
  {
    id: "campana-termo-nomade",
    name: "Termo Expedición Black Mate 1.2L Nómade",
    description: "Acero inox 18/8 · Libre de BPA",
    price: 95000,
    image: "/brand/prod-termo.png",
    category: "Accesorios",
    tab: "accesorios",
    badge: "EDICIÓN ESPECIAL",
    badgeSub: "36HS FRÍO / 24HS CALOR",
    rating: 4.9,
    reviews: 81,
    metaLabel: "CAP",
    metaValue: "1,2 LITROS",
    specLine: "ACERO INOX 18/8 · LIBRE DE BPA",
    color: "NEGRO MATE TÁCTICO",
    cuotas: { n: 3, monto: 31666 },
    transferPrice: 85500,
  },
];

export const PINES_BITACORA = [
  { n: 1, x: "28%", y: "34%", label: "Capucha anti-ventisca" },
  { n: 2, x: "54%", y: "48%", label: "Cremalleras estancas termoselladas" },
  { n: 3, x: "36%", y: "64%", label: "Faldón antinieve" },
];

export const FOOTER_COLS = [
  {
    title: "EQUIPAMIENTO TÉCNICO",
    links: [
      "Camperas 3L Membrana 28K",
      "Pantalones Trail Reforzados CORDURA",
      "Botas & Zapatillas Suela Vibram",
      "Mochilas & Sistemas de Hidratación",
      "Bolsas de Dormir 850 Fill Power",
    ],
  },
  {
    title: "GUÍAS & SOPORTE",
    links: [
      "Guía Técnica de Talles y Capas",
      "Estado y Seguimiento de Envíos",
      "Cambios y Devoluciones Sin Cargo",
      "Garantía de Cordillera (2 Años)",
      "Mantenimiento y Reparación DWR",
    ],
  },
  {
    title: "COMUNIDAD NÓMADE",
    links: [
      "Expedición Los Gigantes & Champaquí",
      "Programa de Embajadores & Guías AAGM",
      "Bitácora & Reseñas de Terreno",
      "Leave No Trace & Conservación Sierras",
      "Talleres de Orientación y Seguridad",
    ],
  },
];

export function formatARS(n: number): string {
  return n.toLocaleString("es-AR");
}

export function esProductoCampana(id: string): boolean {
  return id.startsWith("campana-");
}

export function productoCampanaComoProduct(p: ProductoCampana): Product {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    image: p.image,
    category: p.category,
  };
}

export function resolverCategoriaCatalogo(
  hint: string,
  categorias: string[]
): string {
  const lower = hint.toLowerCase();
  const hit = categorias.find((c) => c.toLowerCase().includes(lower.split(" ")[0]!));
  return hit ?? "Todos";
}
