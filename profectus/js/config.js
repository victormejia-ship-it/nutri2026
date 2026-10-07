/* ┌───────────────────────────────────────────────────────────────────────┐
   │  DATOS DEL PROYECTO DE FIREBASE DE PROFECTUS                           │
   │  Se encuentran en la consola de Firebase → Configuración del           │
   │  proyecto → Tus apps → (app web) → Configuración del SDK.              │
   │  Estos datos NO son secretos: sin una cuenta aprobada nadie entra.     │
   │  La seguridad real está en config/firestore.rules.                     │
   │                                                                       │
   │  Si se dejan VACÍOS, la app trabaja en MODO LOCAL: todo se guarda en   │
   │  este navegador (útil para probar sin Firebase).                       │
   └───────────────────────────────────────────────────────────────────────┘ */
window.CONFIG_NUBE = {
  apiKey:    '',
  projectId: ''
};

/* Datos de la empresa que aparecen en los documentos de cotización.
   También se pueden cambiar desde Admin → Parámetros (eso manda sobre esto). */
window.EMPRESA_DEFAULT = {
  nombre:    'PROFECTUS',
  subtitulo: 'Servicios Especializados',
  razonSocial: '',
  rfc:       '',
  telefono:  '',
  correo:    '',
  direccion: '',
  web:       '',
  ivaPct:    16,
  margenPct: 30,
  vigenciaDias: 15,
  condiciones: 'Precios en moneda nacional (MXN).\nVigencia de la cotización según se indica.\nTiempo de entrega sujeto a disponibilidad de materiales.\nForma de pago: 50% de anticipo y 50% contra entrega.'
};
