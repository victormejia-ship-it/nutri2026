import { aplicarModulosNav } from "../negocio-nav.js";
import { protegerPagina, cerrarSesion } from "../auth.js";
import { db } from "../firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const form = document.getElementById("form-cita");
const mensaje = document.getElementById("cita-mensaje");
const lista = document.getElementById("lista-citas");
const nombreUsuario = document.getElementById("nombre-usuario");

let usuarioActual = null;

document.getElementById("btn-logout").addEventListener("click", async () => {
  await cerrarSesion();
  window.location.href = "login.html";
});

protegerPagina(["usuario", "admin"], async (user, perfil) => {
  usuarioActual = { uid: user.uid, nombre: perfil.nombre, negocioId: perfil.negocioId || null };
  nombreUsuario.textContent = `Hola, ${perfil.nombre}`;
  await aplicarModulosNav(perfil.negocioId);
  await cargarCitas();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await addDoc(collection(db, "citas"), {
    usuarioId: usuarioActual.uid,
    nombreUsuario: usuarioActual.nombre,
    negocioId: usuarioActual.negocioId,
    fecha: document.getElementById("cita-fecha").value,
    hora: document.getElementById("cita-hora").value,
    motivo: document.getElementById("cita-motivo").value.trim(),
    estado: "pendiente",
    creadoEn: new Date().toISOString(),
  });

  form.reset();
  mensaje.textContent = "¡Cita solicitada! Te confirmaremos pronto.";
  mensaje.classList.remove("hidden");
  await cargarCitas();
});

const estilosEstado = {
  pendiente: "bg-yellow-100 text-yellow-700",
  confirmada: "bg-green-100 text-green-700",
  cancelada: "bg-red-100 text-red-700",
};
const etiquetasEstado = { pendiente: "Pendiente", confirmada: "Confirmada", cancelada: "Cancelada" };

async function cargarCitas() {
  const snap = await getDocs(query(collection(db, "citas"), where("usuarioId", "==", usuarioActual.uid)));

  if (snap.empty) {
    lista.innerHTML = `<p class="text-gray-400">Aún no has agendado ninguna cita.</p>`;
    return;
  }

  const citas = snap.docs.map((d) => d.data()).sort((a, b) => (a.fecha + a.hora < b.fecha + b.hora ? 1 : -1));

  lista.innerHTML = citas.map((c) => `
    <div class="bg-white rounded-2xl shadow p-5 flex items-center justify-between gap-4 flex-wrap">
      <div>
        <p class="font-semibold text-gray-900">${c.fecha} · ${c.hora}</p>
        <p class="text-sm text-gray-500">${c.motivo || "Sin motivo especificado"}</p>
      </div>
      <span class="text-xs font-bold px-3 py-1.5 rounded-full ${estilosEstado[c.estado] || ""}">${etiquetasEstado[c.estado] || c.estado}</span>
    </div>
  `).join("");
}
