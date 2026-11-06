# Supuestos, pendientes y riesgos

## Requiere medición real, ficha de fabricante o cotización

| Dato | Estado actual | Qué se necesita |
|---|---|---|
| Espesor real del tablero | Nominal del material, editable por módulo | Medir lote real. |
| Formatos de tablero 1220 × 2440 | Ejemplo | Confirmar por SKU y proveedor. |
| Luz libre de entrepaños (800 mm en melamina 18) | Orientativa | Cálculo de flecha por carga y espesor real. |
| Tabla de bisagras por alto de puerta | Orientativa (`pending_validation`) | Tabla del fabricante del SKU elegido. |
| Cazoleta, base de bisagra, minifix, líneas de soporte, fijación de correderas | Sin coordenadas | Ficha técnica → capturar patrón `verified` con barrenos. |
| Corredera genérica (12.5 mm/lado) | Valor típico no verificado | Ficha de la corredera comprada. |
| Samet SO Class / SmartSlide | Faltan parámetros | Holgura lateral y largos de la ficha. |
| kg/m de PTR | Nulo | Ficha del proveedor de acero. |
| Herrería, anclajes, módulos a muro | Bloqueo de liberación | Diseño/validación estructural externa y tipo de muro. |
| Precios | Ninguno verificado; demo `ESTIMADO` | Cotizaciones con folio o publicaciones con URL y fecha. |
| Dominios oficiales de Sarotech y TYM Forest | URL candidata sin verificar | Confirmar dominio y permisos de integración. |
| Tolerancias (±0.5 mm corte, 2 mm diagonales) | Defaults editables | Capacidad comprobada del taller. |

## Decisiones técnicas

- **Documento JSON versionado por proyecto** (Postgres `jsonb`) + revisiones congeladas: la geometría de un proyecto guardado no cambia salvo migración explícita (`migrateProject`).
- **Motor puro compartido** navegador/servidor; el servidor recalcula cotizaciones y exportaciones desde lo guardado.
- **Sin biblioteca de componentes externa**: controles nativos con etiquetas, roles ARIA en pestañas y radios, foco visible; reduce dependencias.
- **pdf-lib** para el PDF (sin navegador headless en servidor); fuentes estándar WinAnsi, con sustitución de símbolos fuera de ese juego.
- **Mermaid** se exporta como texto; no se carga la librería en la app.
- **Prisma 6 + PostgreSQL 16**; modo demo con archivo JSON para entornos sin base de datos.

## Riesgos

| Riesgo | Mitigación actual | Siguiente paso |
|---|---|---|
| Uso de cantidades orientativas como definitivas | Estados `pending_validation`, bloqueos de liberación, avisos en UI/PDF | Biblioteca de herrajes verificada por SKU. |
| Precios desactualizados | Fecha, vigencia, `VENCIDO` no se usa automáticamente | Alertas por vigencia; histórico por fecha en UI. |
| UI multiusuario sin identidad real | API con tokens por workspace/rol; UI en workspace demo | Integrar OIDC/Auth.js y membresías (modelo ya en Prisma). |
| Modo demo en producción | Insignia «MODO DEMO» visible | Forzar `DATA_BACKEND=prisma` en despliegue. |
| Familias aproximadas | Bloqueo `TEMPLATE_REQUIRES_ENGINE_VALIDATION` | Motores de isla, vestidor, mostrador y exhibidor. |
| Optimizador simple | Rótulo «validar en optimizador del taller» | Retazos, defectos, secuencia de corte, comparación con software del taller. |
| Orden del pintor en SVG con piezas muy delgadas | Orden topológico por separación de cajas | Pruebas visuales de regresión. |

## Siguientes pasos sugeridos

1. Integrar identidad (OIDC) y permisos por rol en la UI.
2. Capturar fichas de 2–3 herrajes reales (bisagra, corredera, minifix) como patrones `verified`.
3. Importador XLSX y conexión autorizada con catálogos de proveedores.
4. Motores específicos de isla y vestidor; cubiertas y rellenos.
5. Mapas de corte dentro del PDF; DXF de piezas una vez definido el posprocesador.
