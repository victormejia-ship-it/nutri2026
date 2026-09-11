import { protegerPagina, cerrarSesion } from "../auth.js";
import { db } from "../firebase-config.js";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const tabla = document.getElementById("tabla-citas");
const nombreAdmin = document.getElementById("nombre-admin");

document.getElementById("btn-logout").addEventListener("click", async () => {
  await cerrarSesion();
  window.location.href = "login.html";
});

protegerPagina(["admin"], async (user, perfil) => {
  nombreAdmin.textContent = `Hola, ${perfil.nombre}`;
  await cargarCitas();
});

const estilosEstado = {
  pendiente: "bg-yellow-100 text-yellow-700",
  confirmada: "bg-green-100 text-green-700",
  cancelada: "bg-red-100 text-red-700",
};

async function cargarCitas() {
  const snap = await getDocs(query(collection(db, "citas"), orderBy("fecha", "desc")));

  if (snap.empty) {
    tabla.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-400">Aún no hay citas agendadas.</td></tr>`;
    return;
  }

  tabla.innerHTML = "";
  snap.forEach((docSnap) => {
    const c = docSnap.data();
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td class="px-6 py-4 font-semibold text-gray-900">${c.nombreUsuario}</td>
      <td class="px-6 py-4">${c.fecha}</td>
      <td class="px-6 py-4">${c.hora}</td>
      <td class="px-6 py-4 text-gray-500">${c.motivo || "—"}</td>
      <td class="px-6 py-4">
        <select data-id="${docSnap.id}" class="select-estado rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold ${estilosEstado[c.estado] || ""}">
          <option value="pendiente" ${c.estado === "pendiente" ? "selected" : ""}>Pendiente</option>
          <option value="confirmada" ${c.estado === "confirmada" ? "selected" : ""}>Confirmada</option>
          <option value="cancelada" ${c.estado === "cancelada" ? "selected" : ""}>Cancelada</option>
        </select>
      </td>
    `;
    tabla.appendChild(fila);
  });

  document.querySelectorAll(".select-estado").forEach((select) => {
    select.addEventListener("change", async (event) => {
      await updateDoc(doc(db, "citas", event.target.dataset.id), { estado: event.target.value });
      await cargarCitas();
    });
  });
}
