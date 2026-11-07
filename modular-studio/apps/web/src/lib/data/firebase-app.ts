'use client';
import { getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';

/**
 * Configuración pública del proyecto Firebase (Configuración del proyecto → Tus apps → Web).
 * Se inyecta en la compilación desde apps/web/.env.production.local (ver docs/PUBLICAR_FIREBASE.md).
 * Estas claves son públicas por diseño: la seguridad la dan Firebase Auth y firestore.rules.
 */
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let cached: { app: FirebaseApp; auth: Auth; db: Firestore } | null = null;

export function firebase() {
  if (cached) return cached;
  if (!config.apiKey || !config.projectId) {
    throw new Error('Falta la configuración de Firebase (NEXT_PUBLIC_FIREBASE_*). Ver docs/PUBLICAR_FIREBASE.md.');
  }
  const app = getApps()[0] ?? initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);
  // Emuladores locales para pruebas (firebase emulators:start)
  const emu = process.env.NEXT_PUBLIC_FIREBASE_EMULATOR_HOST;
  if (emu) {
    connectAuthEmulator(auth, `http://${emu}:9099`, { disableWarnings: true });
    connectFirestoreEmulator(db, emu, 8080);
  }
  cached = { app, auth, db };
  return cached;
}
