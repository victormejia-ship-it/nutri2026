# Auditoría del prototipo HTML (paso A)

Fuente: `docs/fuente/prototipo_original.html` (también entregado como `fabricador_modular_webapp.html`, sin el módulo de costos).

| Función del prototipo | Estado | Dónde quedó / qué cambió |
|---|---|---|
| 14 plantillas en un arreglo fijo del UI | **Corregido** | Catálogo extensible de 18 familias con estrategia y estado (`packages/domain/src/catalog/families.ts`); el UI no tiene casos por familia. |
| Frentes: abierto / 2 puertas / 1 puerta / 3 cajones fijos | **Corregido** | Abierto / puertas (n automático ≤ 600 mm o manual) / cajones (1–10). |
| Validación `W ≤ 2T+50` agrupada en un solo mensaje | **Corregido** | Códigos específicos (`WIDTH_BELOW_DOUBLE_THICKNESS`, `HEIGHT_…`, `DEPTH_INSUFFICIENT`, …) y caso exacto de los fixtures. |
| Costados H × fondo y tapa/piso (W−2T) × fondo | Existente | Conservado como `top_bottom_between_sides` y verificado con el fixture 800/850/550/18 → 2 × 850×550 y 2 × 764×550. Se agregó `sides_between_top_bottom`. |
| Fondo de caja = D − respaldo − frente | Existente | Conservado; el respaldo puede omitirse (advertencia de escuadra). |
| Divisor central fijo si W > 1000 | **Corregido** | Divisores automáticos por luz libre orientativa del material o número manual; advertencia de flecha. |
| Entrepaños con 5 mm de holgura de fondo | Existente | Conservado + holgura lateral configurable; soportes 4 por entrepaño. |
| Puertas `(W−2·2−3)/2`, alto H−4 | Existente | Generalizado a n hojas con holgura perimetral y entre hojas configurables. |
| Cajas de cajón no calculadas | **Corregido** | Se calculan sólo si la corredera elegida declara holgura lateral y largos nominales; si no, bloqueo `DRAWER_SLIDE_NOT_SELECTED` / `DRAWER_SLIDE_PARAMS_MISSING`. |
| Escritorio: cubierta, costados H−T, faldón min(280, H−T−120) | Existente | Conservado y verificado; agregado bastidor PTR con validación de cargas obligatoria. |
| SVG isométrico dibujado con geometría propia (no del BOM) | **Corregido** | La escena se genera de las posiciones 3D de cada pieza del BOM; prueba que compara dimensiones de cada polígono con largo/ancho/espesor. |
| Separación visual de piezas | Existente | Despiece separado por normal de cada pieza; IDs y selección de pieza ↔ tabla. |
| Cotas ancho/alto/fondo | Existente | En las 4 vistas, totales del conjunto. |
| Tabla de corte con cantos `1/0/0/0` | Existente | Ampliada: material, acabado, veta, L1/L2/A1/A2 con ID de canto, estado de validación, mecanizados y observaciones. |
| Mermaid: todas las piezas → CORE | **Corregido** | Subgrafo por módulo, pieza → subconjunto → pasos con dependencias y marcas de pendiente. |
| Pasos de armado fijos | **Corregido** | Derivados del cálculo (divisores, cajones, base, anclaje). |
| Checklist de calidad local a la sesión | **Corregido** | Persistido en el proyecto y congelado en revisiones; diagonales medidas vs. tolerancia. |
| Exportar JSON / SVG / CSV con BOM, imprimir | Existente | JSON versionado con `calcVersion`; CSV `,` o `;` con coma decimal; SVG; PDF real de fabricación. |
| Costos: precios TYM/Saro/Pájaro rotulados «publicado» | **Corregido** | Se conservan como ofertas demo `ESTIMADO` (sin comprobante de SKU/fecha). `supplier_offers.json` inicia vacío por política. |
| Costos: tableros por área + merma | **Corregido** | Acomodo guillotina factible; la estimación por área queda rotulada `estimacion_area_no_validada`. |
| Costos: bisagras `max(2, ceil(H/650)·2)` por puerta | **Corregido** | La fórmula del prototipo daba 4 por puerta a 850 mm. Ahora tabla por alto de puerta (orientativa, `pending_validation`) reemplazable por la del SKU. |
| Costos: pesos en `float`, IVA mezclado | **Corregido** | Centavos enteros; neto sin IVA por oferta; IVA sólo al final. |
| Costos: `venta = conocido/(1−margen)` aun con faltantes | **Corregido** | Fórmula correcta conservada y probada (1000 → 1333.33); con faltantes la cotización es `INCOMPLETO` y sin ningún precio no se muestra importe. |
| Herrería PTR por metros manuales | **Corregido** | Piezas derivadas de la geometría, acomodo en barras de 6.1 m con kerf y merma; masa sólo con kg/m de ficha. |
| Lista de herramientas en el JSON | Pendiente | No migrado; se puede añadir como catálogo de recursos del taller. |
| Backend, usuarios, historial | **Nuevo** | API, repositorio (archivo demo / PostgreSQL), revisiones, duplicar, importar. |

## Pendiente (no implementado, no se finge)

- Proveedor de identidad (OIDC/Auth.js) para la UI multiusuario; hoy la UI usa el workspace demo y la API admite tokens por workspace y rol.
- Motores específicos para isla, vestidor, mostrador, exhibidor y personalizado (hoy aproximados con la caja genérica y bloqueo de validación).
- Biblioteca de herrajes verificada por SKU y sus patrones de mecanizado (estructura lista; faltan fichas).
- DXF, DWG, posprocesadores CNC, renders fotorrealistas (sólo la interfaz `RenderProvider`).
- Nesting con retazos en inventario, defectos y secuencia de seccionadora.
- Importación XLSX (sólo CSV), APIs autorizadas de proveedores, flete por proveedor.
- Cubiertas, recortes de tarja/lavabo, rellenos (fillers) y esquineros.
