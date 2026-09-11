import { protegerPagina, cerrarSesion } from "../auth.js";
import { db } from "../firebase-config.js";
import { requerirNegocio } from "./negocio-guard.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const lista = document.getElementById("lista-planes");
const nombreAdmin = document.getElementById("nombre-admin");
const modal = document.getElementById("modal-plan");
const form = document.getElementById("form-plan");
let negocioId = null;

document.getElementById("btn-logout").addEventListener("click", async () => {
  await cerrarSesion();
  window.location.href = "login.html";
});

protegerPagina(["admin"], async (user, perfil) => {
  if (!requerirNegocio(perfil)) return;
  negocioId = perfil.negocioId;
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
  document.getElementById("plan-enlace-pago").value = plan?.enlacePago || "";
  document.getElementById("plan-destacado").checked = Boolean(plan?.destacado);
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
    enlacePago: document.getElementById("plan-enlace-pago").value.trim(),
    destacado: document.getElementById("plan-destacado").checked,
    negocioId,
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
  const snap = await getDocs(query(collection(db, "planes"), where("negocioId", "==", negocioId)));

  if (snap.empty) {
    lista.innerHTML = `<p class="text-gray-400 col-span-3">Aún no hay planes. Crea el primero con "+ Nuevo plan".</p>`;
    return;
  }

  lista.innerHTML = "";
  snap.forEach((docSnap) => {
    const p = { id: docSnap.id, ...docSnap.data() };
    const tarjeta = document.createElement("div");
    tarjeta.className = `bg-white rounded-3xl shadow-lg p-6 flex flex-col ${p.destacado ? "ring-2 ring-green-500" : ""}`;
    tarjeta.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <h3 class="text-lg font-bold text-gray-900">${p.destacado ? "⭐ " : ""}${p.nombre}</h3>
        ${p.enlacePago
          ? `<span class="flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-green-100 text-green-700">💳 Cobro activo</span>`
          : `<span class="flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">Sin cobro en línea</span>`}
      </div>
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
