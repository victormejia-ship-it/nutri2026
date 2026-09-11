// Configuración de Firebase — Nutripulso
//
// 1. Ve a https://console.firebase.google.com y crea un proyecto.
// 2. Habilita Authentication → Sign-in method → Correo electrónico/contraseña.
// 3. Crea una base de datos en Firestore (modo producción) y sube firestore.rules
//    (raíz del repo) desde Firestore → Reglas.
// 4. En Configuración del proyecto → Tus apps → Web, copia el objeto de
//    configuración y pégalo abajo, reemplazando los valores de ejemplo.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
