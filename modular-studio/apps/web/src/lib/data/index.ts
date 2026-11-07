'use client';
import type { DataClient } from './types';
import { httpClient } from './http';

export type { DataClient, ExportFormat, RevisionMeta } from './types';

/** Seleccionado en compilación: NEXT_PUBLIC_DATA_BACKEND=firebase para el sitio estático en Firebase Hosting. */
export const IS_FIREBASE = process.env.NEXT_PUBLIC_DATA_BACKEND === 'firebase';

let firestoreClientPromise: Promise<DataClient> | null = null;

export async function getDataClient(): Promise<DataClient> {
  if (!IS_FIREBASE) return httpClient;
  firestoreClientPromise ??= import('./firestore').then((m) => m.firestoreClient);
  return firestoreClientPromise;
}
