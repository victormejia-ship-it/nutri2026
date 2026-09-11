import { protegerPagina, cerrarSesion, traducirErrorAuth } from "../auth.js";
import { auth, db } from "../firebase-config.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { updatePassword } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const formPerfil = document.getElementById("form-perfil");
const formPassword = document.getElementById("form-password");
const perfilMensaje = document.getElementById("perfil-mensaje");
const passwordMensaje = document.getElementById("password-mensaje");
const nombreUsuario = document.getElementById("nombre-usuario");

let uidActual = null;

document.getElementById("btn-logout").addEventListener("click", async () => {
  await cerrarSesion();
  window.location.href = "login.html";
});

protegerPagina(["usuario", "admin"], (user, perfil) => {
  uidActual = user.uid;
  nombreUsuario.textContent = `Hola, ${perfil.nombre}`;
  document.getElementById("perfil-nombre").value = perfil.nombre || "";
  document.getElementById("perfil-email").value = perfil.email || "";
  document.getElementById("perfil-telefono").value = perfil.telefono || "";
  document.getElementById("perfil-objetivo").value = perfil.objetivo || "";
});

formPerfil.addEventListener("submit", async (event) => {
  event.preventDefault();
  await updateDoc(doc(db, "users", uidActual), {
    nombre: document.getElementById("perfil-nombre").value.trim(),
    telefono: document.getElementById("perfil-telefono").value.trim(),
    objetivo: document.getElementById("perfil-objetivo").value.trim(),
  });
  mostrarMensaje(perfilMensaje, "Perfil actualizado correctamente.", true);
});

formPassword.addEventListener("submit", async (event) => {
  event.preventDefault();
  const nueva = document.getElementById("password-nueva").value;
  try {
    await updatePassword(auth.currentUser, nueva);
    mostrarMensaje(passwordMensaje, "Contraseña actualizada correctamente.", true);
    formPassword.reset();
  } catch (error) {
    mostrarMensaje(passwordMensaje, traducirErrorAuth(error.code), false);
  }
});

function mostrarMensaje(elemento, texto, exito) {
  elemento.textContent = texto;
  elemento.className = `text-sm font-medium ${exito ? "text-brandDark" : "text-red-600"}`;
}
