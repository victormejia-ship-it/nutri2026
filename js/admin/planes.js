import { protegerPagina, cerrarSesion } from "../auth.js";
import { db } from "../firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const lista = document.getElementById("lista-planes");
const nombreAdmin = document.getElementById("nombre-admin");
const modal = document.getElementById("modal-plan");
const form = document.getElementById("form-plan");

document.getElementById("btn-logout").addEventListener("click", async () => {
  await cerrarSesion();
  window.location.href = "login.html";
});

protegerPagina(["admin"], async (user, perfil) => {
  nombreAdmin.textContent = `Hola, ${perfil.nombre}`;
  await cargarPlanes();
});

document.getElementById("btn-nuevo-plan").addEventListener("click", () => abrirModal());
document.getElementById("btn-cancelar-plan").addEventListener("click", () => cerrarModal());

function abrirModal(plan = null) {
  document.getElementById("modal-titulo").textContent = plan ? "Editar plan" : "Nuevo plan";
  document.getElementById("plan-id").value = plan?.id || "";
  document.getElementById("plan-nombre").value = plan?.nombre || "";
  document.getElementById("plan-precio").value = plan?.precio ?? "";
  document.getElementById("plan-descripcion").value = plan?.descripcion || "";
  document.getElementById("plan-features").value = (plan?.features || []).join("\n");
  modal.classList.remove("hidden");
}

function cerrarModal() {
  modal.classList.add("hidden");
  form.reset();
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = document.getElementById("plan-id").value;
  const datos = {
    nombre: document.getElementById("plan-nombre").value.trim(),
    precio: Number(document.getElementById("plan-precio").value),
    descripcion: document.getElementById("plan-descripcion").value.trim(),
    features: document.getElementById("plan-features").value
      .split("\n").map((f) => f.trim()).filter(Boolean),
  };

  if (id) {
    await updateDoc(doc(db, "planes", id), datos);
  } else {
    await addDoc(collection(db, "planes"), datos);
  }

  cerrarModal();
  await cargarPlanes();
});

async function cargarPlanes() {
  const snap = await getDocs(collection(db, "planes"));

  if (snap.empty) {
    lista.innerHTML = `<p class="text-gray-400 col-span-3">Aún no hay planes. Crea el primero con "+ Nuevo plan".</p>`;
    return;
  }

  lista.innerHTML = "";
  snap.forEach((docSnap) => {
    const p = { id: docSnap.id, ...docSnap.data() };
    const tarjeta = document.createElement("div");
    tarjeta.className = "bg-white rounded-3xl shadow-lg p-6 flex flex-col";
    tarjeta.innerHTML = `
      <h3 class="text-lg font-bold text-gray-900">${p.nombre}</h3>
      <p class="text-sm text-gray-500 mt-1">${p.descripcion || ""}</p>
      <p class="mt-4 text-3xl font-extrabold text-brandDark">$${p.precio}<span class="text-sm font-medium text-gray-400">/mes</span></p>
      <ul class="mt-4 space-y-1.5 text-sm text-gray-600 flex-1">
        ${(p.features || []).map((f) => `<li class="flex gap-2"><span class="text-green-500">✓</span> ${f}</li>`).join("")}
      </ul>
      <div class="mt-6 flex gap-3">
        <button class="btn-editar flex-1 rounded-xl border-2 border-brandDark text-brandDark font-semibold py-2 text-sm">Editar</button>
        <button class="btn-eliminar flex-1 rounded-xl border-2 border-red-200 text-red-600 font-semibold py-2 text-sm">Eliminar</button>
      </div>
    `;
    tarjeta.querySelector(".btn-editar").addEventListener("click", () => abrirModal(p));
    tarjeta.querySelector(".btn-eliminar").addEventListener("click", async () => {
      if (!confirm(`¿Eliminar el plan "${p.nombre}"?`)) return;
      await deleteDoc(doc(db, "planes", p.id));
      await cargarPlanes();
    });
    lista.appendChild(tarjeta);
  });
}
