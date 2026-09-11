import { protegerPagina, cerrarSesion } from "../auth.js";
import { db } from "../firebase-config.js";
import { requerirNegocio } from "./negocio-guard.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const nombreAdmin = document.getElementById("nombre-admin");
const form = document.getElementById("form-negocio");
const mensaje = document.getElementById("negocio-mensaje");
let negocioId = null;

document.getElementById("btn-logout").addEventListener("click", async () => {
  await cerrarSesion();
  window.location.href = "login.html";
});

protegerPagina(["admin"], async (user, perfil) => {
  if (!requerirNegocio(perfil)) return;
  negocioId = perfil.negocioId;
  nombreAdmin.textContent = `Hola, ${perfil.nombre}`;

  const snap = await getDoc(doc(db, "negocios", negocioId));
  const negocio = snap.exists() ? snap.data() : {};
  const modulos = negocio.modulos || {};

  document.getElementById("negocio-nombre").value = negocio.nombre || "";
  document.getElementById("negocio-telefono").value = negocio.telefono || "";
  document.getElementById("negocio-correo").value = negocio.correoContacto || "";
  document.getElementById("negocio-direccion").value = negocio.direccion || "";
  document.getElementById("negocio-descripcion").value = negocio.descripcion || "";
  document.getElementById("negocio-color").value = negocio.colorAcento || "#22C55E";
  document.getElementById("modulo-agenda").checked = modulos.agenda !== false;
  document.getElementById("modulo-recetas").checked = modulos.recetas !== false;
  document.getElementById("modulo-historias").checked = modulos.historias !== false;

  ["agenda", "recetas"].forEach((modulo) => {
    if (modulos[modulo] === false) {
      document.querySelectorAll(`[data-modulo="${modulo}"]`).forEach((el) => el.remove());
    }
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  await updateDoc(doc(db, "negocios", negocioId), {
    nombre: document.getElementById("negocio-nombre").value.trim(),
    telefono: document.getElementById("negocio-telefono").value.trim(),
    correoContacto: document.getElementById("negocio-correo").value.trim(),
    direccion: document.getElementById("negocio-direccion").value.trim(),
    descripcion: document.getElementById("negocio-descripcion").value.trim(),
    colorAcento: document.getElementById("negocio-color").value,
    modulos: {
      agenda: document.getElementById("modulo-agenda").checked,
      recetas: document.getElementById("modulo-recetas").checked,
      historias: document.getElementById("modulo-historias").checked,
    },
  });

  mensaje.textContent = "Cambios guardados. Recarga cualquier otra pestaña abierta para ver los módulos actualizados.";
  mensaje.classList.remove("hidden");
});
