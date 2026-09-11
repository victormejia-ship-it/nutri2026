// Resuelve el negocio "dueño" de esta landing pública: por ahora, el primero
// que se creó (fase 1 del modelo multi-negocio — cada negocio nuevo aún no
// tiene su propio dominio/landing independiente).
import { db } from "./firebase-config.js";
import { collection, query, orderBy, limit, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

let negocioIdCache;

export async function obtenerNegocioIdActual() {
  if (negocioIdCache !== undefined) return negocioIdCache;

  try {
    const snap = await getDocs(query(collection(db, "negocios"), orderBy("creadoEn", "asc"), limit(1)));
    negocioIdCache = snap.empty ? null : snap.docs[0].id;
  } catch (error) {
    negocioIdCache = null;
  }

  return negocioIdCache;
}
