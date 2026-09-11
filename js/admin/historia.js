import { protegerPagina, cerrarSesion } from "../auth.js";
import { db } from "../firebase-config.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { crearTablaEditable } from "../tabla-editable.js";
import { leerCamposPlanos, poblarCamposPlanos } from "../form-utils.js";
import { TABLAS, SECCIONES_LISTA } from "../historia-config.js";

const uid = new URLSearchParams(location.search).get("uid");
const form = document.getElementById("form-historia");
const nombreAdmin = document.getElementById("nombre-admin");
const pacienteNombre = document.getElementById("paciente-nombre");
const guardadoEstado = document.getElementById("guardado-estado");

if (!uid) window.location.href = "admin-dashboard.html";

document.getElementById("btn-logout").addEventListener("click", async () => {
  await cerrarSesion();
  window.location.href = "login.html";
});

// ---------- Tablas fijas / dinámicas ----------
const instanciasTablas = {};

function inicializarTablas(datos) {
  Object.entries(TABLAS).forEach(([nombre, config]) => {
    const contenedor = document.getElementById(config.contenedor);
    instanciasTablas[nombre] = crearTablaEditable({
      contenedor,
      columnas: config.columnas,
      filas: datos[nombre] || [],
      filasFijas: config.filasFijas,
      etiquetas: config.etiquetas || [],
    });
  });
}

// ---------- Secciones tipo "lista + modal" (evaluaciones repetibles) ----------
const datosListas = { antropometria: [], quimica: [], biometria: [], soap: [] };

function renderizarLista(nombreSeccion) {
  const config = SECCIONES_LISTA[nombreSeccion];
  const contenedor = document.getElementById(config.lista);
  const items = datosListas[nombreSeccion];

  if (!items.length) {
    contenedor.innerHTML = `<p class="text-sm text-gray-400">Aún no hay registros.</p>`;
    return;
  }

  contenedor.innerHTML = "";
  items.forEach((item, index) => {
    const fila = document.createElement("div");
    fila.className = "flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-4 py-3 text-sm";
    fila.innerHTML = `
      <span class="text-gray-700">${config.resumen(item)}</span>
      <div class="flex gap-3 flex-shrink-0">
        <button type="button" class="btn-editar-item font-semibold text-brandDark hover:underline">Editar</button>
        <button type="button" class="btn-eliminar-item font-semibold text-red-600 hover:underline">Eliminar</button>
      </div>
    `;
    fila.querySelector(".btn-editar-item").addEventListener("click", () => abrirModalRegistro(nombreSeccion, index));
    fila.querySelector(".btn-eliminar-item").addEventListener("click", () => {
      if (!confirm("¿Eliminar este registro?")) return;
      items.splice(index, 1);
      renderizarLista(nombreSeccion);
    });
    contenedor.appendChild(fila);
  });
}

// ---------- Modal genérico ----------
const modal = document.getElementById("modal-registro");
const formModal = document.getElementById("form-registro");
const modalTitulo = document.getElementById("modal-registro-titulo");
const modalContenido = document.getElementById("modal-registro-contenido");
let seccionActiva = null;
let indiceActivo = null;

function abrirModalRegistro(nombreSeccion, index = null) {
  const config = SECCIONES_LISTA[nombreSeccion];
  seccionActiva = nombreSeccion;
  indiceActivo = index;

  modalTitulo.textContent = index === null ? `Nuevo — ${config.titulo}` : `Editar — ${config.titulo}`;
  const datosExistentes = index === null ? {} : datosListas[nombreSeccion][index];

  modalContenido.innerHTML = config.grupos.map((grupo) => `
    <div>
      ${grupo.titulo ? `<p class="text-xs font-bold text-gray-500 uppercase mb-2">${grupo.titulo}</p>` : ""}
      <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
        ${grupo.campos.map((c) => `
          <div class="${c.tipo === "textarea" ? "col-span-full" : ""}">
            <label class="block text-xs font-semibold text-gray-600 mb-1">${c.label}</label>
            ${c.tipo === "textarea"
              ? `<textarea rows="3" data-field="${c.key}" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"></textarea>`
              : `<input type="${c.tipo === "date" ? "date" : "text"}" data-field="${c.key}" class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />`}
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");

  poblarCamposPlanos(modalContenido, datosExistentes);
  modal.classList.remove("hidden");
}

document.getElementById("btn-cancelar-registro").addEventListener("click", () => modal.classList.add("hidden"));

formModal.addEventListener("submit", (event) => {
  event.preventDefault();
  const datos = leerCamposPlanos(modalContenido);

  if (indiceActivo === null) {
    datosListas[seccionActiva].push(datos);
  } else {
    datosListas[seccionActiva][indiceActivo] = datos;
  }

  renderizarLista(seccionActiva);
  modal.classList.add("hidden");
});

Object.keys(SECCIONES_LISTA).forEach((nombreSeccion) => {
  document.getElementById(SECCIONES_LISTA[nombreSeccion].btnNuevo)
    .addEventListener("click", () => abrirModalRegistro(nombreSeccion));
});

// ---------- Carga y guardado ----------
protegerPagina(["admin"], async (user, perfil) => {
  nombreAdmin.textContent = `Hola, ${perfil.nombre}`;

  const pacienteSnap = await getDoc(doc(db, "users", uid));
  if (!pacienteSnap.exists()) {
    pacienteNombre.textContent = "Paciente no encontrado.";
    return;
  }
  const paciente = pacienteSnap.data();
  pacienteNombre.textContent = `${paciente.nombre} · ${paciente.email}`;

  const historiaSnap = await getDoc(doc(db, "historias", uid));
  const historia = historiaSnap.exists() ? historiaSnap.data() : {};

  poblarCamposPlanos(form, historia);
  inicializarTablas(historia);

  Object.keys(SECCIONES_LISTA).forEach((nombreSeccion) => {
    datosListas[nombreSeccion] = historia[SECCIONES_LISTA[nombreSeccion].campo] || [];
    renderizarLista(nombreSeccion);
  });

  if (historia.actualizadoEn) {
    guardadoEstado.textContent = `Último guardado: ${new Date(historia.actualizadoEn).toLocaleString()}`;
  }
});

document.getElementById("btn-guardar").addEventListener("click", async () => {
  const datos = leerCamposPlanos(form);

  Object.keys(TABLAS).forEach((nombre) => {
    datos[nombre] = instanciasTablas[nombre].leer();
  });

  Object.keys(SECCIONES_LISTA).forEach((nombreSeccion) => {
    datos[SECCIONES_LISTA[nombreSeccion].campo] = datosListas[nombreSeccion];
  });
  datos.actualizadoEn = new Date().toISOString();

  await setDoc(doc(db, "historias", uid), datos);
  guardadoEstado.textContent = `Guardado ✓ ${new Date().toLocaleTimeString()}`;
});
