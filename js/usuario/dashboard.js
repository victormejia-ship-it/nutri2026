import { aplicarModulosNav } from "../negocio-nav.js";
import { protegerPagina, cerrarSesion } from "../auth.js";
import { db } from "../firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const contenedor = document.getElementById("contenedor-plan");
const nombreUsuario = document.getElementById("nombre-usuario");

document.getElementById("btn-logout").addEventListener("click", async () => {
  await cerrarSesion();
  window.location.href = "login.html";
});

protegerPagina(["usuario", "admin"], async (user, perfil) => {
  nombreUsuario.textContent = `Hola, ${perfil.nombre}`;
  await aplicarModulosNav(perfil.negocioId);

  if (!perfil.planAsignado) {
    contenedor.innerHTML = `
      <div class="bg-white rounded-3xl shadow-lg p-10 text-center">
        <p class="text-4xl mb-3">🥗</p>
        <h2 class="text-lg font-bold text-gray-900">Aún no tienes un plan asignado</h2>
        <p class="mt-2 text-gray-500 text-sm max-w-sm mx-auto">
          Agenda tu consulta inicial para que definamos juntos el plan de nutrición ideal para ti.
        </p>
        <a href="usuario-citas.html" class="mt-6 inline-flex items-center justify-center rounded-full bg-green-500 hover:bg-green-400 text-brandDark font-bold px-6 py-3 transition-colors">
          Agendar consulta
        </a>
      </div>
    `;
    return;
  }

  const planSnap = await getDoc(doc(db, "planes", perfil.planAsignado));
  if (!planSnap.exists()) {
    contenedor.innerHTML = `<p class="text-gray-400">Tu plan asignado ya no está disponible. Contacta a tu nutricionista.</p>`;
    return;
  }

  const plan = planSnap.data();
  contenedor.innerHTML = `
    <div class="bg-brandDark text-white rounded-3xl shadow-lg p-8 max-w-md">
      <span class="inline-block bg-green-500 text-brandDark text-xs font-bold px-3 py-1 rounded-full uppercase">Tu plan activo</span>
      <h2 class="mt-4 text-2xl font-extrabold">${plan.nombre}</h2>
      <p class="mt-2 text-green-100 text-sm">${plan.descripcion || ""}</p>
      <p class="mt-4 text-3xl font-extrabold">$${plan.precio}<span class="text-sm font-medium text-green-200">/mes</span></p>
      <ul class="mt-5 space-y-2 text-green-50 text-sm">
        ${(plan.features || []).map((f) => `<li class="flex gap-2"><span>✓</span> ${f}</li>`).join("")}
      </ul>
      ${plan.enlacePago
        ? `<a href="${plan.enlacePago}" target="_blank" rel="noopener" class="mt-6 inline-flex items-center justify-center w-full rounded-full bg-green-500 hover:bg-green-400 text-brandDark font-bold px-6 py-3 transition-colors">
            Pagar / renovar plan
          </a>`
        : ""}
    </div>
  `;
});
