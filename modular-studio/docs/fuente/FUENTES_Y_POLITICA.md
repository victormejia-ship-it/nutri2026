# Proveedores, precios y trazabilidad

## Proveedores prioritarios
1. Sarotech — herrajes/perfiles/accesorios (confirmar dominio oficial y permisos de integración con el proveedor).
2. TYM Forest — tableros y herrajes (confirmar dominio oficial, unidades y precios por variante).
3. El Pájaro Carpintero — melaminas, laminados, tableros; servicios de dimensionado y enchapado. Fuente pública: https://www.elpajarocarpintero.mx/ y catálogo https://www.elpajarocarpintero.mx/productos/ .

## Estados obligatorios de precio
`PUBLICADO_VERIFICADO` (URL/SKU/fecha/captura; confirmar IVA), `COTIZADO` (archivo/folio/vigencia), `CAPTURADO_MANUAL` (origen y autor), `ESTIMADO` (solo simulación), `PENDIENTE` (valor null), `VENCIDO` (no usar automáticamente).

## Integración de precios
Prioridad: API oficial/autorizada > catálogo CSV/XLSX proporcionado > captura de cotización > consulta manual a la web pública con registro de fuente/fecha. Scraping únicamente si permitido técnica/legalmente. No asumir que catálogo de productos muestra precios. Mantener cache con TTL, fechas, moneda, unidad, m2/m/melamina por tablero, stock y ubicación. Precio de línea con IVA incluido o excluido explícito.

## Lógica de compra comparativa
- Normalizar unidad equivalente y presentación comercial, espesor, marca, color, formato y SKU.
- Calcular costo por tablero útil, por m lineal canto, por juego de guías y por paquete de tornillos.
- Comparar costos aterrizados: producto+impuesto+flete+corte+merma+disponibilidad.
- Resaltar 'no comparable' si no coincide especificación técnica.
- Guardar precio manual por proyecto con evidencia. Precio en blanco sigue pendiente.

## Semillas de precios
El ZIP no incluye como 'vigentes' precios copiados de una conversación previa, porque no hay comprobante de SKU/fecha accesible integrado al archivo. `supplier_offers.json` inicia vacío. Claude debe poblarlo sólo con ofertas verificables o cotizaciones adjuntas, registrando fecha y URL. El prototipo HTML sí puede incluir valores orientativos: tratarlos como **demo**, no como fuente de cotización comercial.
