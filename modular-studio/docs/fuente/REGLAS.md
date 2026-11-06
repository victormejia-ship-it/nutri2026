# Motor de fabricación — reglas industriales

## Sistema y geometría
Ejes: X ancho, Y profundidad, Z altura (mm); origen en esquina frontal inferior izquierda del conjunto. Piezas locales con ancho X, fondo Y, espesor Z, transformaciones explícitas. Definir convención de veta longitudinal para cada tablero. Alto exterior no incluye patas/zoclo a menos que parámetro `totalHeightIncludesBase` lo indique. Medidas de corte **no** incluyen tapacanto salvo compensación definida.

## Ejemplo básico de caja sin puertas
W=800 H=850 D=550 T=18 mm; costados completos y tapa/base ENTRE costados. Dos costados: H x D; tapa/base: (W-2*T) x D. Resultado ancho horizontal de tapa/base 764 mm. **No es plantilla universal:** la trasera, rebajes, puertas, zoclo y método de ensamble modifican geometría. Ver fixtures. Validar W>2T y H>0.

## Tapacantos
L1/L2: bordes del largo nominal; A1/A2: bordes del ancho nominal. Largo de canto = suma de aristas marcadas multiplicadas por cantidad; aplicar margen configurado por tramo y merma del rollo. Canteado puede modificar dimensión final: debe ser política explícita.

## Mecanizado
Generar `MachiningOperation` solo desde patrón parametrizado y validado con ficha técnica asociada; estado: `verified`/`pending_validation`/`blocked`. Centros, profundidades y diámetros en mm; comprobar salida de perforación en espesor y choques con otras operaciones. Bisagras, cajones, barras de colgar y sistemas de apertura necesitan fichas exactas por SKU. Jamás fijar universalmente cazoleta o distancia de guías sin fabricante.

## Herrajes
Reglas por geometría y carga: puertas => bisagras con cantidad determinada por catálogo del fabricante; cajones => 1 juego de guías compatible por cajón; entrepaños móviles => soportes; cajas => conectores según método; muebles altos/flotantes => sistema de anclaje con cálculo de carga. No aplicar cantidades genéricas como si fueran instrucciones definitivas.

## Herrería estructural
Estructura opcional: tubos PTR/secciones, perfiles, patas, placas, anclajes, tornillería, soldadura, limpieza y pintura. Cálculo de longitud: segmentos geométricos + cortes + merma. Masa calculada con sección real y densidad si ficha disponible; si no, cotizar por m o kg según presentación. Usar certificación/diseño estructural externo para cargas críticas, voladizos, muebles suspendidos y anclajes a muro; bloquear liberación sin verificación cuando aplique.

## Nesting y tablero
No basta dividir área de piezas / área de tablero. Optimizar cortes rectangulares considerando kerf, veta, orientación permitida, márgenes de escuadrado, rotación, defectos, recortes y stock por formato. Una salida estimada por área debe etiquetarse `estimacion_area_no_validada`; sólo un packing geométrico factible confirma número de tableros.

## Tolerancias / control
Defaults sugeridos editables, no normas universales: ±0.5 mm corte para escuadradora calibrada, ±1 mm conjunto montado; verificar 2 diagonales de caja comparando diferencia con tolerancia configurada; revisar escuadras y chapeado anti-despostillado mediante disco adecuado, incisor, soporte, avance y cinta cuando proceda. No presentar estos defaults como garantías del proveedor o estándares de fábrica.

## Presupuesto
Costo directo = compras comerciales de material (formatos enteros), cantos, herrajes, herrería, consumibles, procesos subcontratados, mano de obra y logística. Separar **IVA** de cada oferta según `taxIncluded` y tasa; evitar doble IVA. Separar desperdicio de rendimiento de corte. `venta_antes_IVA = costo_total_antes_IVA / (1 - margenObjetivo)` para margen sobre venta y `venta_antes_IVA = costo_total_antes_IVA * (1 + markup)` para markup; no confundir.

Si una línea obligatoria tiene precio desconocido, subtotal puede ser parcial pero **precio total debe marcarse INCOMPLETO**, nunca $0. Cada cifra exportada incluye precisión, fuente y vigencia.
