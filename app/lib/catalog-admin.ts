/** Debe coincidir con isCatalogAdmin() en firestore.rules y storage.rules. */
export const CATALOG_ADMIN_EMAIL = "debocab2@gmail.com";

export function esCatalogAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase() === CATALOG_ADMIN_EMAIL.toLowerCase();
}
