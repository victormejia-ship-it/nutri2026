import { registrarUsuario, traducirErrorAuth } from "./auth.js";

const form = document.getElementById("form-registro");
const errorMsg = document.getElementById("form-error");
const btnSubmit = document.getElementById("btn-submit");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMsg.classList.add("hidden");

  const nombre = document.getElementById("nombre").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const password2 = document.getElementById("password2").value;

  if (password !== password2) {
    errorMsg.textContent = "Las contraseñas no coinciden.";
    errorMsg.classList.remove("hidden");
    return;
  }

  btnSubmit.disabled = true;
  btnSubmit.textContent = "Creando cuenta...";

  try {
    await registrarUsuario(nombre, email, password);
    window.location.href = "usuario-dashboard.html";
  } catch (error) {
    errorMsg.textContent = traducirErrorAuth(error.code);
    errorMsg.classList.remove("hidden");
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Crear cuenta";
  }
});
