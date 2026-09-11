import { protegerPagina, cerrarSesion } from "../auth.js";
import { db } from "../firebase-config.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { TABLAS, SECCIONES_LISTA, SECCIONES_PLANAS, obtenerValorAnidado } from "../historia-config.js";

const contenedor = document.getElementById("contenido-historia");
const nombreUsuario = document.getElementById("nombre-usuario");

document.getElementById("btn-logout").addEventListener("click", async () => {
  await cerrarSesion();
  window.location.href = "login.html";
});

const ORDEN = [
  { tipo: "plana", titulo: "Datos generales" },
  { tipo: "tabla", key: "heredofamiliares" },
  { tipo: "plana", titulo: "Antecedentes personales patológicos" },
  { tipo: "tabla", key: "sustancias" },
  { tipo: "plana", titulo: "Antecedentes gineco-obstétricos" },
  { tipo: "tabla", key: "padecimientos" },
  { tipo: "tabla", key: "cardiovascular" },
  { tipo: "plana", titulo: "Antropometría — indicadores generales" },
  { tipo: "lista", key: "antropometria" },
  { tipo: "tabla", key: "actividadFisica" },
  { tipo: "plana", titulo: "Actividad física — resumen" },
  { tipo: "tabla", key: "recomendacionActividad" },
  { tipo: "lista", key: "quimica" },
  { tipo: "lista", key: "biometria" },
  { tipo: "plana", titulo: "Valoración dietética" },
  { tipo: "tabla", key: "recordatorio24h" },
  { tipo: "plana", titulo: "Necesidades energéticas" },
  { tipo: "tabla", key: "diagnosticosPES" },
  { tipo: "tabla", key: "planAlimentacion" },
  { tipo: "tabla", key: "racionesDiarias" },
  { tipo: "tabla", key: "tratamiento" },
  { tipo: "lista", key: "soap" },
];

function escapeHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

function renderPlana(titulo, historia) {
  const seccion = SECCIONES_PLANAS.find((s) => s.titulo === titulo);
  const filas = seccion.campos
    .map((c) => ({ label: c.label, valor: obtenerValorAnidado(historia, c.path) }))
    .filter((f) => f.valor !== undefined && f.valor !== null && String(f.valor).trim() !== "");

  if (!filas.length) return "";

  return `
    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-bold text-gray-900 mb-4">${seccion.titulo}</h2>
      <dl class="grid md:grid-cols-2 gap-4">
        ${filas.map((f) => `
          <div>
            <dt class="text-xs font-semibold text-gray-500">${f.label}</dt>
            <dd class="text-sm text-gray-800 mt-0.5">${escapeHtml(String(f.valor))}</dd>
          </div>
        `).join("")}
      </dl>
    </div>
  `;
}

function renderTabla(key, historia) {
  const config = TABLAS[key];
  const filas = historia[key] || [];
  const totalFilas = config.filasFijas ? config.etiquetas.length : filas.length;
  const hayDatos = filas.some((f) => f && config.columnas.some((c) => f[c.key]));

  if (config.filasFijas ? !hayDatos : totalFilas === 0) return "";

  let cuerpo = "";
  for (let i = 0; i < totalFilas; i++) {
    const fila = filas[i] || {};
    cuerpo += `
      <tr>
        ${config.filasFijas ? `<td class="border border-gray-100 px-2 py-1.5 font-medium whitespace-nowrap">${config.etiquetas[i]}</td>` : ""}
        ${config.columnas.map((c) => `<td class="border border-gray-100 px-2 py-1.5">${escapeHtml(fila[c.key] || "—")}</td>`).join("")}
      </tr>
    `;
  }

  return `
    <div class="bg-white rounded-2xl shadow p-6 overflow-x-auto">
      <h2 class="font-bold text-gray-900 mb-4">${config.titulo}</h2>
      <table class="w-full text-xs border-collapse">
        <thead><tr class="bg-gray-50 text-gray-500 uppercase text-left">
          ${config.filasFijas ? `<th class="px-2 py-2 border border-gray-100"></th>` : ""}
          ${config.columnas.map((c) => `<th class="px-2 py-2 border border-gray-100">${c.label}</th>`).join("")}
        </tr></thead>
        <tbody>${cuerpo}</tbody>
      </table>
    </div>
  `;
}

function renderLista(key, historia) {
  const config = SECCIONES_LISTA[key];
  const items = historia[config.campo] || [];
  if (!items.length) return "";

  const camposPosibles = config.grupos.flatMap((g) => g.campos);

  return `
    <div class="bg-white rounded-2xl shadow p-6">
      <h2 class="font-bold text-gray-900 mb-4">${config.titulo}</h2>
      <div class="space-y-4">
        ${items.map((item) => `
          <div class="border border-gray-100 rounded-xl p-4">
            <p class="text-sm font-semibold text-brandDark mb-2">${escapeHtml(config.resumen(item))}</p>
            <dl class="grid md:grid-cols-3 gap-3 text-xs">
              ${camposPosibles.filter((c) => item[c.key]).map((c) => `
                <div><dt class="font-semibold text-gray-500">${c.label}</dt><dd class="text-gray-800 mt-0.5">${escapeHtml(String(item[c.key]))}</dd></div>
              `).join("")}
            </dl>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

protegerPagina(["usuario", "admin"], async (user, perfil) => {
  nombreUsuario.textContent = `Hola, ${perfil.nombre}`;

  const historiaSnap = await getDoc(doc(db, "historias", user.uid));

  if (!historiaSnap.exists()) {
    contenedor.innerHTML = `
      <div class="bg-white rounded-3xl shadow-lg p-10 text-center">
        <p class="text-4xl mb-3">📋</p>
        <h2 class="text-lg font-bold text-gray-900">Aún no se ha capturado tu historia clínica</h2>
        <p class="mt-2 text-gray-500 text-sm max-w-sm mx-auto">
          Tu nutriólogo la registrará durante tu evaluación inicial.
        </p>
      </div>
    `;
    return;
  }

  const historia = historiaSnap.data();

  const bloques = ORDEN.map((bloque) => {
    if (bloque.tipo === "plana") return renderPlana(bloque.titulo, historia);
    if (bloque.tipo === "tabla") return renderTabla(bloque.key, historia);
    return renderLista(bloque.key, historia);
  }).filter(Boolean);

  contenedor.innerHTML = bloques.length
    ? bloques.join("")
    : `<p class="text-gray-400">Tu historia clínica aún no tiene información capturada.</p>`;
});
