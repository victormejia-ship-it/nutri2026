// Muestra en la landing pública los planes reales capturados en el panel
// admin (colección "planes" de Firestore), con botón de pago cuando el plan
// tiene un enlace de pago configurado.
import { db } from "./firebase-config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const contenedor = document.getElementById("planes-lista");
if (contenedor) cargarPlanesPublicos();

async function cargarPlanesPublicos() {
  try {
    const snap = await getDocs(collection(db, "planes"));

    if (snap.empty) {
      contenedor.innerHTML = `
        <p class="text-gray-400 col-span-3 text-center">
          Muy pronto publicaremos nuestros planes aquí. Mientras tanto,
          <a href="#contacto" class="text-brandDark font-semibold hover:underline">contáctanos directamente</a>.
        </p>`;
      return;
    }

    contenedor.innerHTML = "";
    snap.forEach((docSnap) => {
      const p = docSnap.data();
      const destacado = Boolean(p.destacado);

      const tarjeta = document.createElement("div");
      tarjeta.setAttribute("data-animate", "");
      tarjeta.className = destacado
        ? "opacity-0 translate-y-6 transition-all duration-700 relative bg-brandDark text-white rounded-3xl shadow-2xl p-8 flex flex-col md:-translate-y-4"
        : "opacity-0 translate-y-6 transition-all duration-700 bg-white rounded-3xl shadow-lg p-8 flex flex-col";

      const boton = p.enlacePago
        ? `<a href="${p.enlacePago}" target="_blank" rel="noopener" class="mt-8 inline-flex items-center justify-center rounded-full ${destacado ? "bg-green-500 hover:bg-green-400 text-brandDark" : "bg-green-500 hover:bg-green-400 text-brandDark"} font-bold px-6 py-3 transition-colors">
            Pagar ahora
          </a>`
        : `<a href="#contacto" class="mt-8 inline-flex items-center justify-center rounded-full ${destacado ? "bg-green-500 hover:bg-green-400 text-brandDark font-bold" : "border-2 border-brandDark text-brandDark font-semibold hover:bg-brandLight/20"} px-6 py-3 transition-colors">
            Contactar
          </a>`;

      tarjeta.innerHTML = `
        ${destacado ? `<span class="absolute top-0 right-8 -translate-y-1/2 bg-green-500 text-brandDark text-xs font-bold px-4 py-1.5 rounded-full uppercase tracking-wide">Más popular</span>` : ""}
        <h3 class="text-xl font-bold ${destacado ? "" : "text-gray-900"}">${p.nombre}</h3>
        <p class="mt-2 text-sm ${destacado ? "text-green-200" : "text-gray-500"}">${p.descripcion || ""}</p>
        <p class="mt-6 text-4xl font-extrabold ${destacado ? "" : "text-brandDark"}">$${p.precio}<span class="text-base font-medium ${destacado ? "text-green-200" : "text-gray-400"}">/mes</span></p>
        <ul class="mt-6 space-y-3 ${destacado ? "text-green-50" : "text-gray-600"} flex-1">
          ${(p.features || []).map((f) => `<li class="flex gap-2"><span class="${destacado ? "" : "text-green-500"}">✓</span> ${f}</li>`).join("")}
        </ul>
        ${boton}
      `;
      contenedor.appendChild(tarjeta);
    });

    // Re-observa las nuevas tarjetas para la animación on-scroll de script.js
    document.querySelectorAll("#planes-lista [data-animate]").forEach((el) => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.15 });
      observer.observe(el);
    });
  } catch (error) {
    contenedor.innerHTML = `<p class="text-gray-400 col-span-3 text-center">No se pudieron cargar los planes en este momento.</p>`;
  }
}
