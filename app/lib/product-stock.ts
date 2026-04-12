import type { Product } from "../types";

/** Lee `stock` desde Firestore: solo enteros ≥ 0; ausente o inválido = sin límite. */
export function stockDesdeFirestore(raw: unknown): number | undefined {
  if (raw === undefined || raw === null) return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i < 0) return undefined;
  return i;
}

export function stockTieneLimite(p: Product): boolean {
  return typeof p.stock === "number";
}

/** Hay control de stock y quedó en cero. */
export function productoSinStock(p: Product): boolean {
  return stockTieneLimite(p) && p.stock! <= 0;
}

export function puedeAgregarUnidad(p: Product, cantidadYaEnCarrito: number): boolean {
  if (productoSinStock(p)) return false;
  if (!stockTieneLimite(p)) return true;
  return cantidadYaEnCarrito < (p.stock as number);
}

export function etiquetaStockVitrina(p: Product): string | null {
  if (!stockTieneLimite(p)) return null;
  if (p.stock! <= 0) return "Sin stock";
  return `Quedan ${p.stock}`;
}
