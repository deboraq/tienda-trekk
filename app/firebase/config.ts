import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim(),
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim(),
};

let dbInstance: Firestore | null = null;

export function getDb(): Firestore {
  if (typeof window === "undefined") {
    throw new Error("Firebase solo puede usarse en el cliente.");
  }
  if (!dbInstance) {
    const app: FirebaseApp =
      getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    dbInstance = getFirestore(app);
  }
  return dbInstance;
}
