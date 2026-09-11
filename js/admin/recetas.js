import { protegerPagina, cerrarSesion } from "../auth.js";
import { db } from "../firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const lista = document.getElementById("lista-recetas");
const nombreAdmin = document.getElementById("nombre-admin");
const modal = document.getElementById("modal-receta");
const form = document.getElementById("form-receta");

document.getElementById("btn-logout").addEventListener("click", async () => {
  await cerrarSesion();
  window.location.href = "login.html";
});

protegerPagina(["admin"], async (user, perfil) => {
  nombreAdmin.textContent = `Hola, ${perfil.nombre}`;
  await cargarRecetas();
});

document.getElementById("btn-nueva-receta").addEventListener("click", () => abrirModal());
document.getElementById("btn-cancelar-receta").addEventListener("click", () => cerrarModal());

function abrirModal(receta = null) {
  document.getElementById("modal-titulo").textContent = receta ? "Editar receta" : "Nueva receta";
  document.getElementById("receta-id").value = receta?.id || "";
  document.getElementById("receta-titulo").value = receta?.titulo || "";
  document.getElementById("receta-categoria").value = receta?.categoria || "";
  document.getElementById("receta-contenido").value = receta?.contenido || "";
  modal.classList.remove("hidden");
}

function cerrarModal() {
  modal.classList.add("hidden");
  form.reset();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.getElementById("receta-id").value;
  const datos = {
    titulo: document.getElementById("receta-titulo").value.trim(),
    categoria: document.getElementById("receta-categoria").value.trim(),
    contenido: document.getElementById("receta-contenido").value.trim(),
    creadoEn: new Date().toISOString(),
  };

  if (id) {
    await updateDoc(doc(db, "recetas", id), datos);
  } else {
    await addDoc(collection(db, "recetas"), datos);
  }

  cerrarModal();
  await cargarRecetas();
});

async function cargarRecetas() {
  const snap = await getDocs(query(collection(db, "recetas"), orderBy("creadoEn", "desc")));

  if (snap.empty) {
    lista.innerHTML = `<p class="text-gray-400 col-span-3">Aún no hay recetas. Crea la primera con "+ Nueva receta".</p>`;
    return;
  }

  lista.innerHTML = "";
  snap.forEach((docSnap) => {
    const r = { id: docSnap.id, ...docSnap.data() };
    const tarjeta = document.createElement("div");
    tarjeta.className = "bg-white rounded-3xl shadow-lg p-6 flex flex-col";
    tarjeta.innerHTML = `
      <span class="text-xs font-semibold text-green-600 uppercase">${r.categoria || "General"}</span>
      <h3 class="mt-2 font-bold text-gray-900">${r.titulo}</h3>
      <p class="mt-2 text-sm text-gray-500 flex-1 line-clamp-3">${r.contenido || ""}</p>
      <div class="mt-4 flex gap-3">
        <button class="btn-editar flex-1 rounded-xl border-2 border-brandDark text-brandDark font-semibold py-2 text-sm">Editar</button>
        <button class="btn-eliminar flex-1 rounded-xl border-2 border-red-200 text-red-600 font-semibold py-2 text-sm">Eliminar</button>
      </div>
    `;
    tarjeta.querySelector(".btn-editar").addEventListener("click", () => abrirModal(r));
    tarjeta.querySelector(".btn-eliminar").addEventListener("click", async () => {
      if (!confirm(`¿Eliminar la receta "${r.titulo}"?`)) return;
      await deleteDoc(doc(db, "recetas", r.id));
      await cargarRecetas();
    });
    lista.appendChild(tarjeta);
  });
}
