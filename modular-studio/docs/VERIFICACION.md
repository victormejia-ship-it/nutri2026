# Reporte de verificación

Ejecutado el 2026-11-06 en contenedor Linux con Node 22.23, npm 10.9, PostgreSQL 16 local y Chromium de Playwright 1.63.

| Comando | Resultado |
|---|---|
| `npm install` | OK (workspaces, 0 errores). |
| `npm run lint` | OK, 0 problemas. |
| `npm test` | 4 archivos, 52 pruebas OK, 1 omitida (contrato PostgreSQL sin `DATABASE_URL`). |
| `DATABASE_URL=… npm test` | 53/53 OK (incluye el contrato del repositorio contra PostgreSQL real). |
| `npm run db:migrate` | Migración `init` aplicada en PostgreSQL 16. |
| `npm run db:seed` | 3 proveedores, 7 ofertas demo (0 verificables, por política). |
| `npm run build` | `tsc` estricto (paquetes + app) y `next build` OK; JS compartido 103 kB, editor 168 kB de primera carga. |
| `npm run e2e` | 3/3 OK (ver abajo). |
| Prueba manual con `DATA_BACKEND=prisma` | Crear proyecto, congelar revisión, abrir editor, exportar CSV y listar ofertas contra PostgreSQL: OK. |
| Recálculo completo (motor + acomodo + cotización) | 4 módulos ≈ 1.3 ms; 12 ≈ 1.4 ms; 24 ≈ 2.1 ms (Node, promedio de 10). Objetivo PRD < 200 ms. |

## Cobertura respecto a los criterios de aceptación

| Criterio (06_TESTS/CRITERIOS_ACEPTACION.md) | Evidencia |
|---|---|
| install, migración, seed, dev, build, test, lint | Tabla anterior. |
| BOM/SVG/cotas/presupuesto se actualizan sin inconsistencias | E2E (ancho 900 → cota SVG y tabla); prueba unitaria: cada polígono corresponde a las dimensiones de su pieza del BOM en todas las familias. |
| ≥ 14 familias; 3 verificadas | 18 familias; `kitchen_base`, `wardrobe`, `desk` con pruebas propias. |
| 800/850/550/18 → 2 × 850×550 y 2 × 764×550 | Prueba con `data/seed/fixtures.json`. |
| W ≤ 2T ⇒ sin plan y con error | Prueba unitaria + E2E (alerta en UI). |
| Puertas/cajones ⇒ herrajes pendientes, sin perforaciones inventadas | Prueba: todas las operaciones sin ficha tienen coordenadas `null` y estado pendiente; cajones sin corredera no generan caja. |
| IDs estables; metros de canto correctos; SVG ↔ BOM | Pruebas `IDs estables…`, `tapacantos…`, `placements coinciden…`, `SVG con … IDs de pieza del BOM`. |
| Cambiar precio recalcula; faltante ⇒ INCOMPLETO | Pruebas de cotización + E2E. |
| Margen 25 % sobre $1000 ⇒ $1333.33 (no $1250) | Prueba con el fixture. |
| Normalización con/sin IVA; fecha/proveedor/SKU | Pruebas `normalización de IVA` e importación CSV. |
| Nesting nunca rotula estimación como factible | Prueba del optimizador (sin traslapes, dentro del tablero, todas las piezas colocadas). |
| Proyecto guardado se reabre igual | Prueba de esquema + E2E (recarga). Migración explícita del esquema mínimo probada. |
| SVG con viewBox, labels y cotas mm; CSV/JSON con los mismos datos | Pruebas de exportación. |
| CSV UTF-8 con BOM; separadores | Pruebas con `,` y `;` (coma decimal) + E2E (descarga). |
| Checklist QC, errores bloqueantes, advertencias, trazabilidad por revisión | Pestaña Calidad; revisiones con `calcVersion`, estado de liberación y de cotización. |
| E2E: crear proyecto, cambiar medidas, agregar cajón, elegir proveedor, precio pendiente, descargar exportación | `tests/e2e/editor.spec.ts`. |
| Nada listo para CNC/estructura/certificación sin aprobación | Estados de liberación, bloqueos y aviso en PDF. |

## No verificado

- Despliegue en una plataforma real (sólo `next start` local).
- Navegadores distintos de Chromium; lectores de pantalla (se aplicaron etiquetas, roles y foco visible, sin auditoría AA formal).
- Visualización del PDF en visores distintos de poppler (`pdftoppm`).
