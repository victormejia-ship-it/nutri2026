import { protegerPagina, cerrarSesion } from "../auth.js";
import { db } from "../firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const tabla = document.getElementById("tabla-usuarios");
const nombreAdmin = document.getElementById("nombre-admin");

document.getElementById("btn-logout").addEventListener("click", async () => {
  await cerrarSesion();
  window.location.href = "login.html";
});

protegerPagina(["admin"], async (user, perfil) => {
  nombreAdmin.textContent = `Hola, ${perfil.nombre}`;
  await cargarUsuarios();
});

async function cargarUsuarios() {
  const [usuariosSnap, planesSnap] = await Promise.all([
    getDocs(collection(db, "users")),
    getDocs(collection(db, "planes")),
  ]);

  const planes = planesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (usuariosSnap.empty) {
    tabla.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-400">Aún no hay usuarios registrados.</td></tr>`;
    return;
  }

  tabla.innerHTML = "";
  usuariosSnap.forEach((docSnap) => {
    const u = docSnap.data();
    const uid = docSnap.id;

    const opcionesPlanes = [`<option value="">Sin plan</option>`]
      .concat(planes.map((p) => `<option value="${p.id}" ${u.planAsignado === p.id ? "selected" : ""}>${p.nombre}</option>`))
      .join("");

    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td class="px-6 py-4 font-semibold text-gray-900">${u.nombre || "—"}</td>
      <td class="px-6 py-4 text-gray-500">${u.email}</td>
      <td class="px-6 py-4">
        <select data-uid="${uid}" data-campo="role" class="select-usuario rounded-lg border border-gray-200 px-2 py-1 text-sm">
          <option value="usuario" ${u.role === "usuario" ? "selected" : ""}>Usuario</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
      </td>
      <td class="px-6 py-4">
        <select data-uid="${uid}" data-campo="planAsignado" class="select-usuario rounded-lg border border-gray-200 px-2 py-1 text-sm">
          ${opcionesPlanes}
        </select>
      </td>
      <td class="px-6 py-4 text-right whitespace-nowrap">
        <a href="admin-historia.html?uid=${uid}" class="text-brandDark hover:underline text-sm font-semibold mr-4">Historia clínica</a>
        <button data-uid="${uid}" class="btn-eliminar text-red-600 hover:underline text-sm font-semibold">Eliminar</button>
      </td>
    `;
    tabla.appendChild(fila);
  });

  document.querySelectorAll(".select-usuario").forEach((select) => {
    select.addEventListener("change", async (event) => {
      const { uid, campo } = event.target.dataset;
      await updateDoc(doc(db, "users", uid), { [campo]: event.target.value || null });
    });
  });

  document.querySelectorAll(".btn-eliminar").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar el perfil de este usuario? Esta acción no se puede deshacer.")) return;
      await deleteDoc(doc(db, "users", btn.dataset.uid));
      await cargarUsuarios();
    });
  });
}
