// Oculta los enlaces de navegación (admin y usuario) de los módulos que un
// negocio haya desactivado (Agenda, Recetas, Historia clínica). Usuarios y
// Planes son el núcleo del negocio y siempre están activos.
import { db } from "./firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

export async function aplicarModulosNav(negocioId) {
  if (!negocioId) return;

  const snap = await getDoc(doc(db, "negocios", negocioId));
  const modulos = snap.exists() ? (snap.data().modulos || {}) : {};

  ["agenda", "recetas", "historias"].forEach((modulo) => {
    if (modulos[modulo] === false) {
      document.querySelectorAll(`[data-modulo="${modulo}"]`).forEach((el) => el.remove());
    }
  });
}
