# Criterios de aceptación (Definition of Done)

- [ ] Funciona `npm install`, migración, seed, `npm run dev`, `npm run build`, `npm test` y `npm run lint`.
- [ ] Al cambiar dimensiones, BOM/SVG/cotas/quote se actualizan sin inconsistencias.
- [ ] Catálogo: al menos 14 familias; 3 implementaciones constructivas verificadas (gabinete, clóset, escritorio), restantes con plantillas claras y warnings si falta regla.
- [ ] Caso W800 H850 D550 T18 produce 2 costados 850x550 y 2 horizontales 764x550 para estrategia 'entre costados'.
- [ ] Si W <= 2*T, no se genera plan fabricable y aparece error.
- [ ] Puertas/cajones generan herrajes compatibles o quedan en estado pendiente validación, nunca perforaciones inventadas.
- [ ] Piezas tienen IDs estables; cantos suman metros correctos; proyección SVG corresponde al BOM.
- [ ] Cambiar precio de oferta recalcula costo y venta; si falta cualquier precio obligatorio, total se marca incompleto.
- [ ] Venta con margen 25% sobre costo $1000 sin IVA resulta $1333.33 antes de IVA, NO $1250.
- [ ] Se normalizan precios con/sin IVA para comparar, y se registra fecha/proveedor/SKU.
- [ ] Nesting 2D nunca rotula estimación de área como layout factible.
- [ ] Proyecto versionado guardado se abre de nuevo sin cambiar geometría salvo migración explícita.
- [ ] SVG tiene viewBox, labels y cotas mm; exportes CSV/JSON preservan los mismos datos.
- [ ] CSV con UTF-8 BOM o import amigable Excel en español; separadores gestionados correctamente.
- [ ] Hay checklist QC, errores bloqueantes, advertencias y trazabilidad por revisión.
- [ ] Tests E2E mínimos: crear proyecto, cambiar medidas, agregar cajón, elegir proveedor, precio pendiente, descargar exportación.
- [ ] Nada se presenta como listo para CNC, estructuras suspendidas o certificación sin aprobación documentada.
