import type { HardwareProduct, HingeRule, MachiningPattern } from '../types';

/**
 * Tabla ORIENTATIVA de bisagras por alto de puerta. No es dato de fabricante:
 * toda cantidad derivada queda en `pending_validation` hasta seleccionar un SKU con ficha.
 */
export const GENERIC_HINGE_RULES: HingeRule[] = [
  { maxDoorHeightMm: 900, hingesPerDoor: 2 },
  { maxDoorHeightMm: 1600, hingesPerDoor: 3 },
  { maxDoorHeightMm: 2000, hingesPerDoor: 4 },
  { maxDoorHeightMm: 2400, hingesPerDoor: 5 },
];

export const HARDWARE: HardwareProduct[] = [
  // Bisagras
  {
    id: 'hinge-generic-110', category: 'hinge', name: 'Bisagra cazoleta 35 mm 110° sobrepuesta (genérica)', manufacturer: null, sku: null,
    productKey: 'hw:hinge_overlay_110', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation',
    params: { hingeRules: GENERIC_HINGE_RULES }, machiningPatternId: 'hinge-cup-35',
    notes: 'Seleccionar SKU con ficha técnica antes de perforar; distancia de cazoleta no se asume.',
  },
  {
    id: 'hinge-samet-master110', category: 'hinge', name: 'Bisagra Samet Master 110° cierre suave', manufacturer: 'Samet', sku: 'SAM1010041150',
    productKey: 'hw:samet:SAM1010041150', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation',
    params: { hingeRules: GENERIC_HINGE_RULES }, machiningPatternId: 'hinge-cup-35',
    notes: 'Referencia tomada del prototipo; adjuntar ficha del fabricante para validar tabla de cantidad y mecanizado.',
  },
  // Correderas
  {
    id: 'slide-generic-telescopic', category: 'drawer_slide', name: 'Corredera telescópica lateral (genérica, valores típicos a confirmar)', manufacturer: null, sku: null,
    productKey: 'hw:slide_telescopic', unit: 'juego', technicalDatasheetUrl: null, validationStatus: 'pending_validation',
    params: { sideClearancePerSideMm: 12.5, nominalLengthsMm: [250, 300, 350, 400, 450, 500, 550], drawerBoxThicknessMm: 15 },
    machiningPatternId: 'slide-mount',
    notes: 'Holgura de 12.5 mm/lado es valor típico NO verificado: confirmar con la ficha de la corredera comprada.',
  },
  {
    id: 'slide-samet-soclass-350', category: 'drawer_slide', name: 'Corredera Samet SO Class 350 mm', manufacturer: 'Samet', sku: 'SAM11662153004',
    productKey: 'hw:samet:SAM11662153004', unit: 'juego', technicalDatasheetUrl: null, validationStatus: 'pending_validation',
    params: { nominalLengthsMm: [350] },
    notes: 'Falta holgura lateral en la ficha: la caja de cajón no se calcula hasta capturarla. Verificar si la presentación es pieza o juego.',
  },
  {
    id: 'slide-samet-smartslide-350', category: 'drawer_slide', name: 'Corredera oculta Samet SmartSlide 350 mm', manufacturer: 'Samet', sku: 'SAM127240533',
    productKey: 'hw:samet:SAM127240533', unit: 'juego', technicalDatasheetUrl: null, validationStatus: 'pending_validation',
    params: { nominalLengthsMm: [350], drawerBoxThicknessMm: 16 },
    notes: 'Compatible sólo con caja de 16 mm según referencia del prototipo; despejes según ficha.',
  },
  // Uniones y soportes
  { id: 'cam-minifix15', category: 'cam_connector', name: 'Conector excéntrico tipo minifix 15 mm + perno (genérico)', manufacturer: null, sku: null, productKey: 'hw:cam_minifix15', unit: 'juego', technicalDatasheetUrl: null, validationStatus: 'pending_validation', machiningPatternId: 'cam-minifix' },
  { id: 'dowel-8x35', category: 'dowel', name: 'Taquete de madera 8 × 35 mm', manufacturer: null, sku: null, productKey: 'hw:dowel8x35', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'screw-4x40', category: 'screw', name: 'Tornillo para aglomerado 4 × 40 mm', manufacturer: null, sku: null, productKey: 'hw:screw4x40', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'screw-spax-4x15', category: 'screw', name: 'Tornillo Spax 4 × 15 mm (herrajes/respaldo)', manufacturer: 'Spax', sku: 'SP044015', productKey: 'hw:spax:SP044015', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'shelf-pin-5', category: 'shelf_pin', name: 'Soporte de entrepaño Ø5 mm', manufacturer: null, sku: null, productKey: 'hw:shelf_pin5', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation', machiningPatternId: 'shelf-pin-line-32' },
  { id: 'handle-generic', category: 'handle', name: 'Jaladera (modelo por definir)', manufacturer: null, sku: null, productKey: 'hw:handle_generic', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'leveler-100', category: 'leveler', name: 'Pata niveladora plástica 100–150 mm', manufacturer: null, sku: null, productKey: 'hw:leveler100', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'plinth-clip', category: 'plinth_clip', name: 'Clip para zoclo', manufacturer: null, sku: null, productKey: 'hw:plinth_clip', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'wall-anchor-antitip', category: 'wall_anchor', name: 'Anclaje antivuelco a muro (taquete + escuadra/cable)', manufacturer: null, sku: null, productKey: 'hw:antitip_anchor', unit: 'juego', technicalDatasheetUrl: null, validationStatus: 'pending_validation', notes: 'El taquete depende del tipo de muro (block, concreto, tablaroca). Validar en sitio.' },
  { id: 'cabinet-hanger', category: 'wall_anchor', name: 'Colgador regulable para gabinete aéreo', manufacturer: null, sku: null, productKey: 'hw:cabinet_hanger', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation', notes: 'Capacidad de carga y mecanizado según fabricante; riel/taquete según muro.' },
  { id: 'hanging-rail-oval', category: 'hanging_rail', name: 'Tubo de colgar ovalado (aluminio/acero)', manufacturer: null, sku: null, productKey: 'hw:hanging_rail_oval', unit: 'm', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
  { id: 'hanging-rail-support', category: 'hanging_rail_support', name: 'Soporte de tubo de colgar', manufacturer: null, sku: null, productKey: 'hw:hanging_rail_support', unit: 'pza', technicalDatasheetUrl: null, validationStatus: 'pending_validation' },
];

/**
 * Patrones de mecanizado. Ninguno trae coordenadas: se requieren fichas técnicas.
 * Un patrón con validationStatus 'verified' y `holes` capturados de la ficha sí genera coordenadas.
 */
export const MACHINING_PATTERNS: MachiningPattern[] = [
  { id: 'hinge-cup-35', name: 'Cazoleta de bisagra Ø35 + tornillos de base', hardwareCategory: 'hinge', technicalDatasheetUrl: null, validationStatus: 'pending_validation', holes: [], minRemainingMm: 3 },
  { id: 'cam-minifix', name: 'Excéntrico + perno + taquete', hardwareCategory: 'cam_connector', technicalDatasheetUrl: null, validationStatus: 'pending_validation', holes: [], minRemainingMm: 3 },
  { id: 'shelf-pin-line-32', name: 'Línea de barrenos para soporte de entrepaño', hardwareCategory: 'shelf_pin', technicalDatasheetUrl: null, validationStatus: 'pending_validation', holes: [], minRemainingMm: 4 },
  { id: 'slide-mount', name: 'Fijación de corredera a costado', hardwareCategory: 'drawer_slide', technicalDatasheetUrl: null, validationStatus: 'pending_validation', holes: [], minRemainingMm: 4 },
];
