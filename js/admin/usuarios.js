import { protegerPagina, cerrarSesion } from "../auth.js";
import { db } from "../firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const tabla = document.getElementById("tabla-usuarios");
const nombreAdmin = document.getElementById("nombre-admin");
const bannerConfigurar = document.getElementById("banner-configurar-negocio");
const cajaLink = document.getElementById("caja-link-registro");

document.getElementById("btn-logout").addEventListener("click", async () => {
  await cerrarSesion();
  window.location.href = "login.html";
});

let uidAdmin = null;

protegerPagina(["admin"], async (user, perfil) => {
  uidAdmin = user.uid;
  nombreAdmin.textContent = `Hola, ${perfil.nombre}`;

  if (!perfil.negocioId) {
    bannerConfigurar.classList.remove("hidden");
    return;
  }

  mostrarLinkRegistro(perfil.negocioId);
  await cargarUsuarios(perfil.negocioId);
});

function mostrarLinkRegistro(negocioId) {
  const url = `${location.origin}${location.pathname.replace("admin-dashboard.html", "")}registro.html?negocio=${negocioId}`;
  document.getElementById("texto-link-registro").textContent = url;
  cajaLink.classList.remove("hidden");

  document.getElementById("btn-copiar-link").addEventListener("click", async () => {
    await navigator.clipboard.writeText(url);
    const btn = document.getElementById("btn-copiar-link");
    btn.textContent = "¡Copiado!";
    setTimeout(() => { btn.textContent = "Copiar link"; }, 2000);
  });
}

// ---------- Configuración inicial del negocio + migración de datos previos ----------
document.getElementById("form-configurar-negocio").addEventListener("submit", async (event) => {
  event.preventDefault();
  const nombreNegocio = document.getElementById("nombre-negocio-nuevo").value.trim();
  const btn = document.getElementById("btn-configurar-negocio");
  const mensaje = document.getElementById("mensaje-configurar-negocio");

  btn.disabled = true;
  btn.textContent = "Configurando...";

  const negocioRef = await addDoc(collection(db, "negocios"), {
    nombre: nombreNegocio,
    creadoPor: uidAdmin,
    creadoEn: new Date().toISOString(),
  });
  const negocioId = negocioRef.id;

  await updateDoc(doc(db, "users", uidAdmin), { negocioId });

  mensaje.textContent = "Negocio creado. Migrando tus datos anteriores...";
  mensaje.classList.remove("hidden");

  const totalMigrados = await migrarDatosSinNegocio(negocioId);

  mensaje.textContent = `Listo — ${totalMigrados} registro(s) anteriores asignados a "${nombreNegocio}". Recargando...`;
  setTimeout(() => window.location.reload(), 1200);
});

async function migrarDatosSinNegocio(negocioId) {
  const colecciones = ["users", "planes", "recetas", "citas", "historias"];
  let total = 0;

  for (const nombreColeccion of colecciones) {
    const snap = await getDocs(collection(db, nombreColeccion));
    const pendientes = snap.docs.filter((d) => !d.data().negocioId);
    await Promise.all(pendientes.map((d) => updateDoc(doc(db, nombreColeccion, d.id), { negocioId })));
    total += pendientes.length;
  }

  return total;
}

// ---------- Listado de usuarios del negocio ----------
async function cargarUsuarios(negocioId) {
  const [usuariosSnap, planesSnap] = await Promise.all([
    getDocs(query(collection(db, "users"), where("negocioId", "==", negocioId))),
    getDocs(query(collection(db, "planes"), where("negocioId", "==", negocioId))),
  ]);

  const planes = planesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  if (usuariosSnap.empty) {
    tabla.innerHTML = `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-400">Aún no hay usuarios registrados.</td></tr>`;
    return;
  }

  tabla.innerHTML = "";
  usuariosSnap.forEach((docSnap) => {
    const u = docSnap.data();
    const uid = docSnap.id;

    const opcionesPlanes = [`<option value="">Sin plan</option>`]
      .concat(planes.map((p) => `<option value="${p.id}" ${u.planAsignado === p.id ? "selected" : ""}>${p.nombre}</option>`))
      .join("");

    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td class="px-6 py-4 font-semibold text-gray-900">${u.nombre || "—"}</td>
      <td class="px-6 py-4 text-gray-500">${u.email}</td>
      <td class="px-6 py-4">
        <select data-uid="${uid}" data-campo="role" class="select-usuario rounded-lg border border-gray-200 px-2 py-1 text-sm">
          <option value="usuario" ${u.role === "usuario" ? "selected" : ""}>Usuario</option>
          <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
        </select>
      </td>
      <td class="px-6 py-4">
        <select data-uid="${uid}" data-campo="planAsignado" class="select-usuario rounded-lg border border-gray-200 px-2 py-1 text-sm">
          ${opcionesPlanes}
        </select>
      </td>
      <td class="px-6 py-4 text-right whitespace-nowrap">
        <a href="admin-historia.html?uid=${uid}" class="text-brandDark hover:underline text-sm font-semibold mr-4">Historia clínica</a>
        <button data-uid="${uid}" class="btn-eliminar text-red-600 hover:underline text-sm font-semibold">Eliminar</button>
      </td>
    `;
    tabla.appendChild(fila);
  });

  document.querySelectorAll(".select-usuario").forEach((select) => {
    select.addEventListener("change", async (event) => {
      const { uid, campo } = event.target.dataset;
      await updateDoc(doc(db, "users", uid), { [campo]: event.target.value || null });
    });
  });

  document.querySelectorAll(".btn-eliminar").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar el perfil de este usuario? Esta acción no se puede deshacer.")) return;
      await deleteDoc(doc(db, "users", btn.dataset.uid));
      await cargarUsuarios(negocioId);
    });
  });
}
