// Nutripulso — helpers de autenticación y control de acceso por rol
import { auth, db } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  addDoc,
  collection,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// Registro de un paciente: siempre queda ligado a un negocio (nutriólogo/
// clínica) existente — se registra a través del link que ese negocio
// comparte (registro.html?negocio=<id>).
export async function registrarUsuario(nombre, email, password, negocioId) {
  const credencial = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credencial.user, { displayName: nombre });
  await setDoc(doc(db, "users", credencial.user.uid), {
    nombre,
    email,
    role: "usuario",
    negocioId,
    telefono: "",
    objetivo: "",
    planAsignado: null,
    creadoEn: new Date().toISOString(),
  });
  return credencial.user;
}

// Registro de un negocio nuevo (nutriólogo/clínica): crea el documento del
// negocio y, en el mismo flujo, la cuenta de su administrador.
export async function registrarNegocio(nombreNegocio, nombreAdmin, email, password) {
  const credencial = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(credencial.user, { displayName: nombreAdmin });

  const negocioRef = await addDoc(collection(db, "negocios"), {
    nombre: nombreNegocio,
    telefono: "",
    correoContacto: email,
    direccion: "",
    descripcion: "",
    colorAcento: "#22C55E",
    modulos: { agenda: true, recetas: true, historias: true },
    creadoPor: credencial.user.uid,
    creadoEn: new Date().toISOString(),
  });

  await setDoc(doc(db, "users", credencial.user.uid), {
    nombre: nombreAdmin,
    email,
    role: "admin",
    negocioId: negocioRef.id,
    telefono: "",
    objetivo: "",
    planAsignado: null,
    creadoEn: new Date().toISOString(),
  });

  return { user: credencial.user, negocioId: negocioRef.id };
}

export async function obtenerNegocio(negocioId) {
  const snap = await getDoc(doc(db, "negocios", negocioId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function iniciarSesion(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function cerrarSesion() {
  return signOut(auth);
}

export async function obtenerPerfil(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data() : null;
}

// Protege una página: exige sesión iniciada y, si se especifican, uno de los
// roles permitidos. Llama a onListo(user, perfil) cuando todo es válido.
export function protegerPagina(rolesPermitidos, onListo) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }
    const perfil = await obtenerPerfil(user.uid);
    if (!perfil || (rolesPermitidos && !rolesPermitidos.includes(perfil.role))) {
      window.location.href = "index.html";
      return;
    }
    onListo(user, perfil);
  });
}

// Traduce los códigos de error de Firebase Auth a mensajes en español.
export function traducirErrorAuth(codigo) {
  const mensajes = {
    "auth/email-already-in-use": "Ese correo ya está registrado.",
    "auth/invalid-email": "El correo electrónico no es válido.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Intenta de nuevo más tarde.",
    "auth/requires-recent-login": "Por seguridad, vuelve a iniciar sesión antes de cambiar tu contraseña.",
  };
  return mensajes[codigo] || "Ocurrió un error. Intenta de nuevo.";
}
