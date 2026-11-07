# PROMPT MAESTRO PARA CLAUDE — MODULAR STUDIO

Actúa como arquitecto Full-Stack Senior, diseñador industrial especializado en carpintería modular, ingeniero de fabricación y responsable de QA. **Debes construir y entregar código funcional**, no limitarte a recomendaciones o maquetas. Usa todos los archivos del ZIP como fuente de requisitos. Comienza leyendo `00_LEEME/README.md` y auditando `07_PROTOTIPO/index.html`. Conserva funcionalidades útiles y corrige las que sean aproximadas.

## Producto
Una plataforma web universal para múltiples familias de muebles (cocinas, alacenas, clósets, vestidores, escritorios, credenzas, muebles TV, libreros, cómodas, burós, baños, lavandería, zapateras, comerciales, a medida); NO una calculadora de un único gabinete. El usuario crea proyectos, selecciona plantilla o diseño propio, edita módulos, medidas, puertas/cajones, tableros, tapacantos, herrajes y herrería. La interfaz recalcula en tiempo real geometría, despiece, cortes, mecanizados, ensamblaje, costo y presupuesto; permite guardar versiones y exportar.

## Stack preferido
Next.js App Router + React + TypeScript strict + Tailwind + biblioteca de componentes accesible + Prisma/PostgreSQL. Diagramas SVG propios paramétricos y Mermaid para el ensamblaje. Zod para validación, tests unitarios con Vitest y E2E con Playwright. Usa librerías libres consolidadas cuando aporten valor; justifica cualquier dependencia. Si el entorno no permite levantar PostgreSQL, incluir modo demo local con persistencia mock claramente identificada.

## Requisitos críticos
1. Catálogo extensible, no casos hardcodeados en el UI.
2. Modelo de unidades único mm/MXN y motor de piezas puro, determinista y testeable.
3. SVG con proyección isométrica, cotas, IDs, vista de despiece y selección de partes; etiquetas legibles; no confundir SVG 2D con un CAD 3D real.
4. Tabla de corte ID, nombre, cantidad, largo/ancho/espesor, veta, lados tapacanto (L1/L2/A1/A2), material, SKU, observaciones, merma y acabado.
5. Mecanizados: soporte a patrones de perforación según ficha de fabricante y estado `pendiente_validacion`, sin afirmar coordenadas sin ficha. Cualquier taladro incompatible debe generar advertencia.
6. BOM de herrajes por tipo: bisagras, guías, minifix/rafix, soportes, tiradores, niveladores, tornillos; según cantidad y configuración. Herrería opcional: PTR, perfiles, placas, soldadura, acabado anticorrosivo, anclajes y costo de fabricación; requerir validación de cargas/seguridad.
7. Motor de presupuestos: tablero entero vs optimización de corte, tapacanto por longitud, herrajes por presentación y unidad, corte/canteado, transporte, mano de obra, herrería, consumibles, merma, IVA, utilidad/margen. Comparar ofertas Sarotech, TYM Forest y El Pájaro Carpintero (pueden cotizar otros proveedores), con SKU, enlace, fecha, unidad, IVA, disponibilidad, fuente, confiabilidad y estado; NO generar precios ficticios ni hacer scraping contra políticas. Fallback manual/CSV y cotización pendiente. No confundir "margen" con "markup".
8. Exportar: JSON versionado, CSV en UTF-8 para piezas y costos, SVG y PDF de fabricación, Mermaid. DXF sólo si implementado y probado; no prometer DWG nativo sin backend/capacidad real.
9. Validación final de BOM, dimensiones, cantos, tolerancias, diagonales, colisiones, cantos visibles, apertura de puertas, interferencias y estados no fabricables.
10. Renders fotorealistas: interfaz preparada para servicio de imágenes opcional, diferenciar inspiración visual y render geométricamente fiel; no inventar API keys.
11. Funciones CRUD proyecto, historial, duplicar, comparar precios, seleccionar proveedores, exportar cotización profesional.
12. UX escritorio/tablet, mobile consultivo; accesibilidad AA básica; estados vacíos, carga y error.

## Qué debes entregar
- Repositorio Next.js completo con código real y estructura definida en `02_ARQUITECTURA/ARQUITECTURA.md`.
- README con instalación reproducible, `.env.example`, comandos, `docker-compose.yml` opcional, migraciones y seeds.
- Implementación operativa vertical para gabinete de cocina + escritorio + clóset; resto de familias modeladas como plantillas parametrizables con reglas diferenciadas y marcación explícita de funciones no terminadas, no fingir completitud.
- Motor genérico de composición de módulos para ampliar todas las familias.
- Pantallas: dashboard, catálogo, editor, isométrico, despiece, montaje, herrajes/herrería, proveedores/precios, presupuesto, QC y exportaciones.
- Unit tests y E2E; captura de errores; instrucciones de despliegue.
- Documentación de supuestos pendientes y riesgos.

## Orden de ejecución
A. Audita el HTML y crea tabla 'existente / pendiente / corregir'.
B. Implementa esquema de tipos, motor de geometría y tests del núcleo.
C. Implementa React editor y SVG conectado al motor.
D. Implementa BOM, herrería, costos y cotizaciones con manejo de precios pendientes.
E. Persistencia, API, exportaciones y QA.
F. Ejecuta build + tests; entrega reporte de verificaciones, errores y siguientes pasos.

**No me hagas preguntas ya respondidas en los documentos; toma decisiones técnicas justificadas, usa valores configurables y documenta lo que requiera medición real, ficha de fabricante o cotización.**
