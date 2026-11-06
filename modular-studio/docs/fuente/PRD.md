# PRD — Plataforma universal de diseño y fabricación

## Usuarios
- Carpintero: genera despiece, corte, armado, herrajes y control dimensional.
- Diseñador industrial: configura variantes, materiales, frentes, vetas, ergonomía y cotas.
- Cotizador/compras: compara material, SKU, cotizaciones, IVA, costo y fecha.
- Administrador: controla catálogos, fichas de proveedor, parámetros, márgenes y permisos.

## Flujos principales
1. Crear proyecto y seleccionar plantilla; registrar cliente, obra, unidades, escala y moneda.
2. Diseñar conjunto de módulos y sus restricciones; vista isométrica, frente, lateral y planta.
3. Elegir sustrato, acabado, canto, espesor nominal/real, veta, fondo y método de montaje.
4. Configurar puertas, cajones, entrepaños, zoclo, patas, bastidores y herrajes compatibles.
5. Generar lista de piezas y mapas de ensamblaje; comprobar errores y advertencias.
6. Elegir proveedores y precios de compra; calcular cantidades comerciales, costos y precio de venta.
7. Exportar expediente y guardar revisión; histórico de precios por fecha.

## Familias cubiertas
Cocina: gabinete bajo, alacena, gabinete superior, isla; Recámara: clóset/vestidor, cómoda, buró; Oficina: escritorio, credenza/archivero; Sala: TV flotante/apoyado, librero; Servicios: baño, lavandería, zapatera; Comercial: exhibidor, mostrador; Custom: composición libre.

## Edición de módulo
- Geometría: ancho, alto, profundidad, espesor, composición, sentido de veta, trasera, luz útil, holguras, posición en conjunto.
- Componentes: costados, base, tapa, refuerzos, fondos, separadores, repisas, frentes, cajones, puertas, traseras.
- Fijación: tornillo, tarugo, minifix/rafix, escuadra, perfil de aluminio, unión mixta.
- Herrería: patas, bastidores y anclajes con advertencias de resistencia.

## No funcional
Recalcular en interfaz en <200 ms en proyectos típicos (objetivo a medir); exportes sin pérdida numérica; logs de cambios; formatos internacionales sin ambigüedad; cálculos con precisión decimal; responsabilidad por revisión en taller.

## V1 / V2
V1: catálogo, editor, piezas, SVG, BOM, presupuestos, precios manuales/CSV, exportes, tests y persistencia.
V2: nesting 2D real, biblioteca de herrajes verificada, importación de listas autorizadas, PDF completo, DXF, optimización avanzada, configuraciones estructurales.
V3: colaboración, integración ERP/compras, CNC posprocesadores homologados, cotizaciones conectadas y render foto verificado.
