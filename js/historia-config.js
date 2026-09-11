// Configuración compartida de la Historia Clínica Nutricional — usada por el
// editor de admin (admin-historia.html) y la vista de solo lectura del
// paciente (usuario-historia.html), para que ambas muestren exactamente las
// mismas secciones/columnas sin duplicar la definición.

const SELECT_SI_NO = ["", "Sí", "No"];

export const TABLAS = {
  heredofamiliares: {
    titulo: "Antecedentes heredofamiliares",
    contenedor: "tabla-heredofamiliares",
    filasFijas: true,
    etiquetas: [
      "Diabetes", "Hipertensión", "Cáncer", "Obesidad", "Cardiopatías",
      "Dislipidemias (especificar)", "Enfermedad renal", "Enfermedad hepática",
      "Endócrino-metabólicas", "Otras (especificar)",
    ],
    columnas: [
      { key: "presencia", label: "Presencia", tipo: "select", opciones: SELECT_SI_NO },
      { key: "parentesco", label: "Parentesco", tipo: "text" },
    ],
  },
  sustancias: {
    titulo: "Consumo de sustancias bioactivas",
    contenedor: "tabla-sustancias",
    filasFijas: true,
    etiquetas: ["Alcohol", "Tabaco", "Bebidas con cafeína", "Drogas"],
    columnas: [
      { key: "presencia", label: "Presencia", tipo: "select", opciones: SELECT_SI_NO },
      { key: "tipo", label: "Tipo", tipo: "text" },
      { key: "frecuencia", label: "Frecuencia", tipo: "text" },
      { key: "cantidad", label: "Cantidad", tipo: "text" },
    ],
  },
  padecimientos: {
    titulo: "Padecimiento actual y terapéutica",
    contenedor: "tabla-padecimientos",
    filasFijas: false,
    columnas: [
      { key: "padecimiento", label: "Padecimiento", tipo: "text" },
      { key: "terapeutica", label: "Terapéutica", tipo: "text" },
    ],
  },
  cardiovascular: {
    titulo: "Valoración cardiovascular",
    contenedor: "tabla-cardiovascular",
    filasFijas: false,
    columnas: [
      { key: "fecha", label: "Fecha", tipo: "text" },
      { key: "ta", label: "TA", tipo: "text" },
      { key: "fcP", label: "FC P", tipo: "text" },
      { key: "fcP1", label: "FC P1", tipo: "text" },
      { key: "fcP2", label: "FC P2", tipo: "text" },
      { key: "indiceRuffier", label: "Índice Ruffier", tipo: "text" },
      { key: "diagnostico", label: "Diagnóstico", tipo: "text" },
    ],
  },
  actividadFisica: {
    titulo: "Actividad física o deporte",
    contenedor: "tabla-actividad-fisica",
    filasFijas: false,
    columnas: [
      { key: "tipo", label: "Tipo", tipo: "text" },
      { key: "antiguedad", label: "Antigüedad", tipo: "text" },
      { key: "frecuencia", label: "Frecuencia (días/sem)", tipo: "text" },
      { key: "horario", label: "Horario", tipo: "text" },
      { key: "duracion", label: "Duración (min)", tipo: "text" },
      { key: "intensidad", label: "Intensidad", tipo: "text" },
      { key: "mets", label: "METs", tipo: "text" },
      { key: "costoEnergetico", label: "Costo energético", tipo: "text" },
    ],
  },
  recomendacionActividad: {
    titulo: "Recomendación de actividad física",
    contenedor: "tabla-recomendacion-actividad",
    filasFijas: false,
    columnas: [
      { key: "tipo", label: "Tipo", tipo: "text" },
      { key: "fcMaxTeorica", label: "FC máx. teórica", tipo: "text" },
      { key: "zonaMin", label: "Zona mín (%-p/m)", tipo: "text" },
      { key: "zonaMax", label: "Zona máx (%-p/m)", tipo: "text" },
      { key: "frecuencia", label: "Frecuencia", tipo: "text" },
      { key: "duracion", label: "Duración (min)", tipo: "text" },
      { key: "intensidad", label: "Intensidad", tipo: "text" },
      { key: "mets", label: "METs", tipo: "text" },
      { key: "costoEnergetico", label: "Costo energético", tipo: "text" },
    ],
  },
  diagnosticosPES: {
    titulo: "Diagnósticos nutricionales (formato PES)",
    contenedor: "tabla-diagnosticos-pes",
    filasFijas: false,
    columnas: [
      { key: "problema", label: "Problema", tipo: "text" },
      { key: "etiologia", label: "Etiología", tipo: "text" },
      { key: "signosSintomas", label: "Signos y síntomas", tipo: "text" },
    ],
  },
  recordatorio24h: {
    titulo: "Recordatorio de 24 horas",
    contenedor: "tabla-recordatorio24h",
    filasFijas: false,
    columnas: [
      { key: "tiempoComida", label: "Tiempo comida", tipo: "text" },
      { key: "lugarHora", label: "Lugar/hora", tipo: "text" },
      { key: "platillo", label: "Platillo", tipo: "text" },
      { key: "alimento", label: "Alimento/ingrediente", tipo: "text" },
      { key: "cantidad", label: "Cantidad", tipo: "text" },
      { key: "equivalentes", label: "Equivalentes", tipo: "text" },
      { key: "hco", label: "HCO (g)", tipo: "text" },
      { key: "proteinas", label: "Proteínas (g)", tipo: "text" },
      { key: "lipidos", label: "Lípidos (g)", tipo: "text" },
      { key: "kcal", label: "Kcal", tipo: "text" },
    ],
  },
  tratamiento: {
    titulo: "Tratamiento nutricional",
    contenedor: "tabla-tratamiento",
    filasFijas: false,
    columnas: [
      { key: "fecha", label: "Fecha", tipo: "text" },
      { key: "tipoDieta", label: "Tipo de dieta", tipo: "text" },
      { key: "requerimientoDiario", label: "Requerimiento diario (kcal)", tipo: "text" },
      { key: "habitoTrabajar", label: "Hábito a trabajar", tipo: "text" },
    ],
  },
};

export const GRUPOS_SMAE = [
  "Verduras", "Frutas", "Cereales y tubérculos — sin grasa", "Cereales y tubérculos — con grasa", "Leguminosas",
  "Alimentos de origen animal — muy bajo aporte de grasa", "Alimentos de origen animal — bajo aporte de grasa",
  "Alimentos de origen animal — moderado aporte de grasa", "Alimentos de origen animal — alto aporte de grasa",
  "Leche — descremada", "Leche — semidescremada", "Leche — entera", "Leche — con azúcar",
  "Aceites y grasas — sin proteína", "Aceites y grasas — con proteína",
  "Azúcares — sin grasa", "Azúcares — con grasa",
  "TOTALES", "META A ALCANZAR", "% ADECUACIÓN MÍNIMO", "% ADECUACIÓN MÁXIMO",
];

TABLAS.planAlimentacion = {
  titulo: "Cálculo del plan de alimentación (Sistema Mexicano de Equivalentes)",
  contenedor: "tabla-plan-alimentacion",
  filasFijas: true,
  etiquetas: GRUPOS_SMAE,
  columnas: [
    { key: "raciones", label: "Raciones", tipo: "text" },
    { key: "energia", label: "Energía (kcal)", tipo: "text" },
    { key: "proteinas", label: "Proteínas (g)", tipo: "text" },
    { key: "lipidos", label: "Lípidos (g)", tipo: "text" },
    { key: "hco", label: "HCO (g)", tipo: "text" },
  ],
};

TABLAS.racionesDiarias = {
  titulo: "Cálculo de raciones diarias",
  contenedor: "tabla-raciones-diarias",
  filasFijas: true,
  etiquetas: GRUPOS_SMAE.slice(0, 17),
  columnas: [
    { key: "totales", label: "Totales", tipo: "text" },
    { key: "desayuno", label: "Desayuno", tipo: "text" },
    { key: "colacion1", label: "Colación 1", tipo: "text" },
    { key: "comida", label: "Comida", tipo: "text" },
    { key: "colacion2", label: "Colación 2", tipo: "text" },
    { key: "cena", label: "Cena", tipo: "text" },
  ],
};

const CAMPOS_ANTROPOMETRIA = [
  { titulo: "General", campos: [
    { key: "fecha", label: "Fecha", tipo: "date" },
    { key: "pesoActual", label: "Peso actual (kg)" },
    { key: "talla", label: "Talla (cm)" },
  ]},
  { titulo: "Pliegues cutáneos (mm)", campos: [
    "pectoral", "triceps", "subescapular", "biceps", "supracrestal", "supraespinal", "abdominal", "muslo", "pantorrilla",
  ].map((k) => ({ key: k, label: k[0].toUpperCase() + k.slice(1) }))},
  { titulo: "Perímetros (cm)", campos: [
    { key: "cabeza", label: "Cabeza" }, { key: "cuello", label: "Cuello" },
    { key: "brazoRelajado", label: "Brazo relajado" }, { key: "brazoContraccion", label: "Brazo en contracción" },
    { key: "antebrazo", label: "Antebrazo" }, { key: "munecaMinimo", label: "Muñeca mínimo" },
    { key: "toraxMesoesternal", label: "Tórax (mesoesternal)" }, { key: "cinturaMinimo", label: "Cintura (mínimo)" },
    { key: "caderaMaximo", label: "Cadera (máximo)" }, { key: "musloMedio", label: "Muslo medio" },
    { key: "pantorrillaMaximo", label: "Pantorrilla (máximo)" }, { key: "tobilloMinimo", label: "Tobillo (mínimo)" },
  ]},
  { titulo: "Diámetros (cm)", campos: [
    { key: "biacromial", label: "Biacromial" }, { key: "toraxAnteroposterior", label: "Tórax anteroposterior" },
    { key: "toraxTransverso", label: "Tórax transverso" }, { key: "biliocrestoideo", label: "Biliocrestoideo" },
    { key: "humero", label: "Húmero (biepicondilo)" }, { key: "femur", label: "Fémur (biepicondilo)" },
    { key: "muneca", label: "Muñeca (biestiloideo)" },
  ]},
  { titulo: "Longitudes (cm)", campos: [
    { key: "radioEstiloideo", label: "Radio-estiloideo" }, { key: "trocanterTibial", label: "Trocánter tibial" },
    { key: "tibialLateral", label: "Tibial lateral" },
  ]},
  { titulo: "Índices", campos: [
    { key: "somatotipo", label: "Somatotipo" }, { key: "imc", label: "IMC (kg/m²)" },
    { key: "diagnosticoImc", label: "Diagnóstico IMC" }, { key: "densidadCorporal", label: "Densidad corporal" },
    { key: "masaMuscularKerr", label: "% Masa muscular (Kerr)" }, { key: "masaMuscularMatiegka", label: "% Masa muscular (Matiegka)" },
    { key: "masaResidual", label: "% Masa residual" }, { key: "masaOsea", label: "% Masa ósea" },
    { key: "grasaActual", label: "% Grasa actual (Siri)" }, { key: "grasaOptimo", label: "% Grasa óptimo" },
    { key: "diferenciaPorcentajeGrasa", label: "Diferencia % grasa" }, { key: "diferenciaKgGrasa", label: "Diferencia kg grasa" },
    { key: "pesoIdeal", label: "Peso ideal (kg)" }, { key: "objetivoAntropometrico", label: "Objetivo antropométrico" },
  ]},
];

const CAMPOS_QUIMICA = [{ campos: [
  { key: "fechaHora", label: "Fecha y hora", tipo: "text" },
  { key: "glucosa", label: "Glucosa" }, { key: "colesterolTotal", label: "Colesterol total" },
  { key: "trigliceridos", label: "Triglicéridos" }, { key: "lactato", label: "Lactato" },
  { key: "ctHdl", label: "CT HDL" }, { key: "ctLdl", label: "CT LDL" },
  { key: "albumina", label: "Albúmina" }, { key: "prealbumina", label: "Prealbúmina" },
  { key: "transferrina", label: "Transferrina" }, { key: "acidoUrico", label: "Ácido úrico" },
  { key: "urea", label: "Urea" }, { key: "creatinina", label: "Creatinina" },
  { key: "sodio", label: "Sodio" }, { key: "calcio", label: "Calcio" },
  { key: "fosforo", label: "Fósforo" }, { key: "otros", label: "Otros" },
]}];

const CAMPOS_BIOMETRIA = [{ campos: [
  { key: "fecha", label: "Fecha", tipo: "date" },
  { key: "cuentaEritrocitos", label: "Cuenta de eritrocitos" },
  { key: "hemoglobina", label: "Hemoglobina" },
  { key: "hematocrito", label: "Hematocrito" },
  { key: "cuentaLeucocitos", label: "Cuenta de leucocitos" },
  { key: "otro", label: "Otro" },
]}];

const CAMPOS_SOAP = [
  { campos: [
    { key: "fecha", label: "Fecha", tipo: "date" },
    { key: "numeroSeguimiento", label: "Número de seguimiento" },
  ]},
  { titulo: "S — Subjetivo", campos: [{ key: "s", label: "Generalidades, síntomas y hábitos del paciente", tipo: "textarea" }] },
  { titulo: "O — Objetivo", campos: [{ key: "o", label: "Diagnóstico y tratamiento médico", tipo: "textarea" }] },
  { titulo: "A — Análisis", campos: [{ key: "a", label: "Diagnósticos nutricionales y requerimientos", tipo: "textarea" }] },
  { titulo: "P — Plan", campos: [{ key: "p", label: "Objetivos y plan de alimentación", tipo: "textarea" }] },
];

export const SECCIONES_LISTA = {
  antropometria: {
    campo: "antropometriaEvaluaciones",
    lista: "lista-antropometria", btnNuevo: "btn-nueva-antropometria",
    titulo: "Evaluación antropométrica", grupos: CAMPOS_ANTROPOMETRIA,
    resumen: (d) => `${d.fecha || "Sin fecha"} — Peso: ${d.pesoActual || "—"} kg · Talla: ${d.talla || "—"} cm`,
  },
  quimica: {
    campo: "quimicaEvaluaciones",
    lista: "lista-quimica", btnNuevo: "btn-nueva-quimica",
    titulo: "Registro de química sanguínea", grupos: CAMPOS_QUIMICA,
    resumen: (d) => `${d.fechaHora || "Sin fecha"} — Glucosa: ${d.glucosa || "—"} · Colesterol: ${d.colesterolTotal || "—"}`,
  },
  biometria: {
    campo: "biometriaEvaluaciones",
    lista: "lista-biometria", btnNuevo: "btn-nueva-biometria",
    titulo: "Registro de biometría hemática", grupos: CAMPOS_BIOMETRIA,
    resumen: (d) => `${d.fecha || "Sin fecha"} — Hemoglobina: ${d.hemoglobina || "—"} · Hematocrito: ${d.hematocrito || "—"}`,
  },
  soap: {
    campo: "notasSOAP",
    lista: "lista-soap", btnNuevo: "btn-nueva-soap",
    titulo: "Nota clínica SOAP", grupos: CAMPOS_SOAP,
    resumen: (d) => `${d.fecha || "Sin fecha"} — Seguimiento #${d.numeroSeguimiento || "—"}`,
  },
};

// Secciones de campos simples (no tabulares) para la vista de solo lectura.
export const SECCIONES_PLANAS = [
  { titulo: "Datos generales", campos: [
    { path: "datosGenerales.fechaElaboracion", label: "Fecha de elaboración" },
    { path: "datosGenerales.fechaNacimiento", label: "Fecha de nacimiento" },
    { path: "datosGenerales.ocupacion", label: "Ocupación" },
    { path: "datosGenerales.colonia", label: "Colonia" },
    { path: "datosGenerales.delegacionMunicipio", label: "Delegación o municipio" },
    { path: "datosGenerales.telefono", label: "Teléfono" },
    { path: "datosGenerales.motivoConsulta", label: "Motivo de la consulta" },
    { path: "realizadaPor", label: "Nutriólogo evaluador" },
  ]},
  { titulo: "Antecedentes personales patológicos", campos: [
    { path: "personalesPatologicos.observaciones", label: "Observaciones" },
    { path: "personalesPatologicos.alergias", label: "Alergias o intolerancias" },
    { path: "personalesPatologicos.horasSueno", label: "Horas de sueño al día" },
  ]},
  { titulo: "Antecedentes gineco-obstétricos", campos: [
    { path: "ginecoObstetricos.menarca", label: "Menarca" },
    { path: "ginecoObstetricos.ritmo", label: "Ritmo" },
    { path: "ginecoObstetricos.eumenorrea", label: "Eumenorrea" },
    { path: "ginecoObstetricos.dismenorrea", label: "Dismenorrea" },
    { path: "ginecoObstetricos.mpf", label: "MPF" },
    { path: "ginecoObstetricos.g", label: "G (gestas)" },
    { path: "ginecoObstetricos.p", label: "P (partos)" },
    { path: "ginecoObstetricos.a", label: "A (abortos)" },
    { path: "ginecoObstetricos.c", label: "C (cesáreas)" },
    { path: "ginecoObstetricos.fum", label: "FUM" },
    { path: "ginecoObstetricos.observaciones", label: "Observaciones" },
  ]},
  { titulo: "Antropometría — indicadores generales", campos: [
    { path: "antropometria.indicadores.pesoHabitual", label: "Peso habitual (kg)" },
    { path: "antropometria.indicadores.pesoMaximo", label: "Peso máximo (kg)" },
    { path: "antropometria.indicadores.pesoMinimo", label: "Peso mínimo (kg)" },
    { path: "antropometria.indicadores.edad", label: "Edad (años)" },
  ]},
  { titulo: "Actividad física — resumen", campos: [
    { path: "actividadFisica.totalMinutos", label: "Total minutos/semana" },
    { path: "actividadFisica.costoEnergeticoTotal", label: "Costo energético total" },
    { path: "actividadFisica.cumpleACSM", label: "¿Cumple recomendaciones ACSM?" },
  ]},
  { titulo: "Valoración dietética", campos: [
    { path: "dietetica.dietaEspecial", label: "¿Ha llevado dieta especial?" },
    { path: "dietetica.tipoDieta", label: "Tipo de dieta" },
    { path: "dietetica.comidasAlDia", label: "Comidas al día" },
    { path: "dietetica.quienPrepara", label: "¿Quién prepara sus alimentos?" },
    { path: "dietetica.apetito", label: "Apetito" },
    { path: "dietetica.litrosAgua", label: "Litros/vasos de agua al día" },
    { path: "dietetica.frutasAlDia", label: "Frutas al día" },
    { path: "dietetica.verdurasAlDia", label: "Verduras al día" },
    { path: "dietetica.alimentosPreferidos", label: "Alimentos preferidos" },
    { path: "dietetica.alimentosNoAgradan", label: "Alimentos que no le agradan" },
  ]},
  { titulo: "Necesidades energéticas", campos: [
    { path: "necesidadesEnergeticas.pesoIdealSeleccionado", label: "Peso ideal seleccionado (kg)" },
    { path: "necesidadesEnergeticas.metabolismoBasal", label: "Metabolismo basal (kcal)" },
    { path: "necesidadesEnergeticas.af", label: "AF (kcal)" },
    { path: "necesidadesEnergeticas.total", label: "Total GET/día (kcal)" },
    { path: "necesidadesEnergeticas.formulaUtilizada", label: "Fórmula utilizada" },
  ]},
];

export function obtenerValorAnidado(objeto, ruta) {
  return ruta.split(".").reduce((nodo, parte) => (nodo == null ? undefined : nodo[parte]), objeto);
}
