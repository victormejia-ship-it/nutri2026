import { iniciarSesion, obtenerPerfil, traducirErrorAuth } from "./auth.js";

const form = document.getElementById("form-login");
const errorMsg = document.getElementById("form-error");
const btnSubmit = document.getElementById("btn-submit");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMsg.classList.add("hidden");

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  btnSubmit.disabled = true;
  btnSubmit.textContent = "Ingresando...";

  try {
    const credencial = await iniciarSesion(email, password);
    const perfil = await obtenerPerfil(credencial.user.uid);
    window.location.href = perfil?.role === "admin" ? "admin-dashboard.html" : "usuario-dashboard.html";
  } catch (error) {
    errorMsg.textContent = traducirErrorAuth(error.code);
    errorMsg.classList.remove("hidden");
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Iniciar sesión";
  }
});
