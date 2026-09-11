import { registrarUsuario, obtenerNegocio, traducirErrorAuth } from "./auth.js";

const form = document.getElementById("form-registro");
const errorMsg = document.getElementById("form-error");
const btnSubmit = document.getElementById("btn-submit");
const subtituloNegocio = document.getElementById("subtitulo-negocio");
const avisoInvalido = document.getElementById("aviso-enlace-invalido");

const negocioId = new URLSearchParams(location.search).get("negocio");

(async () => {
  if (!negocioId) {
    mostrarEnlaceInvalido();
    return;
  }
  const negocio = await obtenerNegocio(negocioId);
  if (!negocio) {
    mostrarEnlaceInvalido();
    return;
  }
  subtituloNegocio.textContent = `Te estás registrando con ${negocio.nombre}.`;
})();

function mostrarEnlaceInvalido() {
  avisoInvalido.classList.remove("hidden");
  form.classList.add("hidden");
}

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
    await registrarUsuario(nombre, email, password, negocioId);
    window.location.href = "usuario-dashboard.html";
  } catch (error) {
    errorMsg.textContent = traducirErrorAuth(error.code);
    errorMsg.classList.remove("hidden");
    btnSubmit.disabled = false;
    btnSubmit.textContent = "Crear cuenta";
  }
});
