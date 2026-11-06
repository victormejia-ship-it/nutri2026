# MODULAR STUDIO — paquete de transferencia a Claude

**Objetivo:** construir una Web App universal para diseñar, documentar, presupuestar y fabricar muebles modulares en México, con base en el prototipo HTML incluido.

## Inicio rápido
1. Abrir `07_PROTOTIPO/index.html` en navegador: base existente (sin backend; estimaciones orientativas).
2. Abrir Claude y adjuntar **todo este ZIP**, o pegar `08_PROMPTS/PROMPT_MAESTRO_CLAUDE.md` y adjuntar los archivos.
3. Pedir que primero audite el prototipo y conserve las funciones útiles; luego cree el repositorio Next.js completo y ejecutable.
4. Pedir migraciones, pruebas, documentación y guía de despliegue, no solamente pantallas de muestra.

## Contenido
- `01_PRODUCTO`: PRD, alcance, catálogo y flujos.
- `02_ARQUITECTURA`: módulos, API, esquema de datos y estructura del monorepo.
- `03_DATOS`: JSON de familias, materiales, proveedores, ejemplo de proyecto y modelo de datos.
- `04_MOTOR_FABRICACION`: reglas de geometría, despiece, mecanizado, herrajes, costos, optimización y seguridad.
- `05_PROVEEDORES_PRECIOS`: estrategia de captura de precios, estado de verificación y fuentes oficiales.
- `06_TESTS`: criterios de aceptación y casos de prueba.
- `07_PROTOTIPO`: **HTML original entregado**, punto de partida, no aplicación industrial validada.
- `08_PROMPTS`: prompt maestro para Claude y prompts por fase.

## Principios obligatorios
- Todas las dimensiones internas en **milímetros**; moneda **MXN**; IVA explícito; idioma es-MX.
- Separar cotas geométricas calculadas de reglas parametrizadas del fabricante. Nunca inventar cotas de mecanizado de herrajes.
- No presentar precio sin fuente y fecha como vigente; no convertir ausencia de precio en $0.
- Conectar geometría, BOM/despiece, costos y planos a un **único modelo de proyecto** versionado.
- El render fotográfico es opcional y **no sirve como plano de fabricación**; SVG/CAD paramétrico es la fuente gráfica técnica.
- No afirmar certificación, colaboración ni afiliación comercial con Sarotech, TYM Forest o El Pájaro Carpintero.

## Estado actual del prototipo
- Implementado en HTML: controles por familias, geometría SVG esquemática, listado básico de piezas, Mermaid textual, checklist, exportaciones y módulo orientativo de costos.
- **NO** implementado: backend, usuarios, base de datos, historial, sincronización automática de proveedores, anidamiento real de corte 2D, CNC industrial, validación de herrajes por marca, renders foto derivados del mismo CAD, validación estructural de herrería.

Ver `08_PROMPTS/PROMPT_MAESTRO_CLAUDE.md` para arrancar.
