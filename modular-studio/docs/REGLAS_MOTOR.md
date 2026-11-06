# Reglas del motor de fabricación (calcVersion 1.0.0)

Código: `packages/domain/src/engine/`. Valores configurables: `ENGINE_DEFAULTS` (`module.ts`), `PricingSettings` y `CutSettings` del proyecto. Ninguno es una norma universal.

## Convenciones

- Unidades: mm; dinero en centavos MXN enteros.
- Ejes del módulo: X ancho, Y profundidad (0 = frente), Z altura; origen en la esquina frontal-inferior-izquierda. Los módulos se colocan en fila sobre X y se alinean por el respaldo (contra muro).
- La altura exterior `H` es la de la caja; la base (zoclo/patas/bastidor) se suma aparte (`overallHeightMm`).
- Medidas de corte nominales, sin compensar el tapacanto.
- `L1/L2` = aristas a lo largo del largo de la pieza; `A1/A2` = aristas del ancho. `L1` es la arista frontal visible en piezas de caja.
- ID de pieza: `<módulo>-<código>` (p. ej. `M01-SIDE`); cada pieza lleva una posición 3D por unidad (`placements`).

## Caja

| Elemento | Regla |
|---|---|
| Profundidad de caja | `cd = D − espesor respaldo − (frente ≠ abierto ? T : 0)`; error si `cd < 100`. |
| Tapa/piso entre costados | Costados `H × cd`; horizontales `(W − 2T) × cd`. |
| Costados entre tapa/piso | Horizontales `W × cd`; costados `(H − 2T) × cd`. |
| Respaldo sobrepuesto | `H × W × B`, fijado con tornillos a paso 150 mm (orientativo). Sin respaldo ⇒ advertencia de escuadra. |
| Divisores | Automático: `ceil(IW / luz) − 1` con la luz libre orientativa del material; o número manual. Con cajones se omiten. |
| Entrepaños | `(hueco − 2) × (cd − 5)`, equiespaciados; 4 soportes Ø5 por entrepaño. Advertencia si el hueco excede la luz libre. |
| Clóset | Por hueco: maletero a 350 mm de la tapa y tubo 50 mm debajo; si hay ≥2 huecos y `entrepaños > 1`, el último hueco es torre de entrepaños. Antivuelco obligatorio. |
| Puertas | n = automático `ceil(W/600)` o manual; ancho `(W − 2r − (n−1)g)/n`, alto `H − 2r`. Bisagras por alto de puerta según tabla del producto (la genérica es orientativa). |
| Cajones | Frentes `(H − 2r − (n−1)g)/n × (W − 2r)`. La caja sólo se calcula con corredera que declare holgura lateral y largos nominales: largo = mayor nominal ≤ `cd − 10`; ancho = `W − 2T − 2·holgura`; costados/frente-trasera del espesor que pide la corredera; fondo 6 mm sobrepuesto. |
| Uniones | 4 uniones de caja + 2 por divisor; conectores por unión: 2 (≤400 mm), 3 (≤700), 4. Excéntrico + taquete, taquete, tornillo o mixta. |
| Base | Patas niveladoras (4 o 6), bastidor de zoclo remetido 40 mm, o bastidor PTR (validación estructural obligatoria). |
| Montaje | A muro ⇒ colgadores + bloqueo `WALL_MOUNT_VALIDATION`. Piso con altura ≥ 1200 mm, clóset, o cajonera ≥ 600 mm ⇒ antivuelco + bloqueo `ANTITIP_REQUIRED`. |

## Escritorio

Cubierta `W × D`; costados tipo panel `(H − T) × D`; faldón `(W − 2T) × min(280, H − T − 120)` remetido 20 mm. Advertencias de claro de cubierta, altura libre (< 620 mm) y ancho libre (< 600 mm). Con PTR: 4 patas, 2 largueros y 2 travesaños; bloqueo `STEEL_LOAD_VALIDATION_REQUIRED`.

## Validaciones geométricas

- Pieza que no cabe en el tablero (respetando veta si el acabado la tiene) ⇒ error `PART_EXCEEDS_SHEET`.
- Interferencia volumétrica entre cualquier par de piezas ⇒ error `COLLISION`.
- Módulo vecino más profundo con frentes ⇒ `DOOR_OPENING_INTERFERENCE`.
- Mecanizado verificado: barreno ciego que deja menos del remanente mínimo ⇒ `MACHINING_DEPTH_EXCEEDS`; barrenos traslapados ⇒ `MACHINING_HOLE_COLLISION`; fuera de pieza ⇒ `MACHINING_OUTSIDE_PART`.
- Diagonales medidas: diferencia > tolerancia ⇒ `DIAGONAL_OUT_OF_TOLERANCE` (no fabricable).

## Severidades y liberación

`error` (no fabricable) · `blocker` (requiere validación externa documentada) · `warning` · `info`.
Liberación: `NO_FABRICABLE` si hay errores; `PENDIENTE_VALIDACION` si hay bloqueos o mecanizado sin ficha; `LISTO_PARA_APROBACION` si no; `LIBERADO_CON_APROBACION` sólo con responsable y, si había pendientes, evidencia.

## Tapacanto

Largo neto = Σ aristas marcadas × cantidad. Compra = (neto + tramos × margen por tramo) × (1 + merma de rollo).

## Corte

Guillotina BSSF con división por eje de menor sobrante; kerf entre piezas; escuadrado por lado; rotación sólo si la pieza no tiene veta o el acabado no la muestra. Sólo un acomodo completo da `layout_factible`.

## Presupuesto

1. Requerimientos: tableros (del acomodo), canto (m), herrajes agregados por clave, herrería (m de barras completas), servicios manuales.
2. Ofertas por clave equivalente: neto = precio ÷ (1 + IVA) si el IVA está incluido; compra = `ceil(requerido / presentación)`.
3. Selección: manual por requerimiento o automática (la utilizable más barata). No utilizables: `PENDIENTE`, vencidas, IVA no definido, `ESTIMADO` sin permiso, sin disponibilidad.
4. Venta: margen `costo/(1−m)` o markup `costo×(1+k)`; IVA sobre la venta.
5. Estado: `INCOMPLETO` si falta un precio obligatorio (o la oferta elegida está vencida o sin IVA definido); `SIMULACION` si usa estimados; `COMPLETO` en otro caso. Sin ninguna línea con precio, los importes son `null`.
