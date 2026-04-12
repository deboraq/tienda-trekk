import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let app: App | null = null;

/** Firestore Admin (solo servidor). Requiere FIREBASE_SERVICE_ACCOUNT_JSON en producción. */
export function getFirebaseAdminApp(): App {
  if (app) return app;
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!json?.trim()) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON no está configurado.");
  }
  const cred = cert(JSON.parse(json) as Record<string, unknown>);
  if (getApps().length === 0) {
    app = initializeApp({ credential: cred });
  } else {
    app = getApps()[0]!;
  }
  return app;
}

export function getAdminFirestore() {
  return getFirestore(getFirebaseAdminApp());
}

export function adminInventarioDisponible(): boolean {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim());
}
