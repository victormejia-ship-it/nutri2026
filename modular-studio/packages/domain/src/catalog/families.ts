import type { FamilyDefinition, FamilyDefaults } from '../types';

const d = (o: Partial<FamilyDefaults> & Pick<FamilyDefaults, 'widthMm' | 'heightMm' | 'depthMm'>): FamilyDefaults => ({
  front: 'doors',
  doorCount: null,
  drawerCount: 0,
  shelvesPerBay: 1,
  baseType: 'none',
  baseHeightMm: 0,
  mount: 'floor',
  ...o,
});

/**
 * Catálogo de familias. Basado en 03_DATOS/familias.json y en las plantillas del prototipo HTML.
 * El UI no tiene casos hardcodeados: todo sale de esta lista y del motor por estrategia.
 */
export const FAMILIES: FamilyDefinition[] = [
  {
    id: 'kitchen_base', name: 'Gabinete bajo de cocina', category: 'kitchen', geometryStrategy: 'box', status: 'verified_vertical',
    description: 'Caja con costados completos, tapa y piso entre costados, respaldo sobrepuesto y frentes sobrepuestos. Patas niveladoras.',
    defaults: d({ widthMm: 800, heightMm: 720, depthMm: 580, baseType: 'levelers', baseHeightMm: 100 }),
    pendingRules: ['La cubierta (granito/cuarzo/laminado) no forma parte del despiece de tablero.'],
  },
  {
    id: 'kitchen_wall', name: 'Gabinete aéreo', category: 'kitchen', geometryStrategy: 'box', status: 'configurable_base_template',
    description: 'Caja colgada a muro. Requiere sistema de colgado y cálculo de anclaje.',
    defaults: d({ widthMm: 800, heightMm: 700, depthMm: 350, mount: 'wall' }),
    pendingRules: ['Colgadores regulables y su mecanizado dependen de la ficha del fabricante.'],
  },
  {
    id: 'pantry', name: 'Alacena vertical', category: 'kitchen', geometryStrategy: 'box', status: 'configurable_base_template',
    description: 'Mueble alto de almacenamiento con entrepaños regulables.',
    defaults: d({ widthMm: 600, heightMm: 2100, depthMm: 580, shelvesPerBay: 4, baseType: 'levelers', baseHeightMm: 100 }),
    pendingRules: ['Puertas altas: definir número de bisagras con tabla del fabricante y peso real.'],
  },
  {
    id: 'kitchen_island', name: 'Isla de cocina', category: 'kitchen', geometryStrategy: 'composite', status: 'template_requires_engine_validation',
    description: 'Composición de módulos bajos espalda con espalda; se aproxima como caja.',
    defaults: d({ widthMm: 1600, heightMm: 720, depthMm: 900, baseType: 'plinth', baseHeightMm: 100 }),
    pendingRules: ['Motor de composición espalda-con-espalda, paneles de remate y voladizo de cubierta pendientes.'],
  },
  {
    id: 'wardrobe', name: 'Clóset / armario', category: 'bedroom', geometryStrategy: 'wardrobe', status: 'verified_vertical',
    description: 'Caja alta con divisores por luz libre, maletero, tubo de colgar por hueco y anclaje antivuelco.',
    defaults: d({ widthMm: 1200, heightMm: 2200, depthMm: 600, shelvesPerBay: 1, baseType: 'plinth', baseHeightMm: 80 }),
    pendingRules: [],
  },
  {
    id: 'walkin', name: 'Vestidor', category: 'bedroom', geometryStrategy: 'composite', status: 'template_requires_engine_validation',
    description: 'Sistema abierto de torres y entrepaños; se aproxima como clóset abierto.',
    defaults: d({ widthMm: 1800, heightMm: 2200, depthMm: 550, front: 'open', shelvesPerBay: 3, baseType: 'plinth', baseHeightMm: 80 }),
    pendingRules: ['Composición en L/U y esquineros pendientes.'],
  },
  {
    id: 'dresser', name: 'Cómoda', category: 'bedroom', geometryStrategy: 'box', status: 'configurable_base_template',
    description: 'Caja con frentes de cajón. Las cajas de cajón se calculan sólo con corredera seleccionada.',
    defaults: d({ widthMm: 900, heightMm: 900, depthMm: 500, front: 'drawers', drawerCount: 4, shelvesPerBay: 0, baseType: 'plinth', baseHeightMm: 60 }),
    pendingRules: ['Anclaje antivuelco recomendado para cómodas; validar con fabricante del herraje.'],
  },
  {
    id: 'nightstand', name: 'Buró', category: 'bedroom', geometryStrategy: 'box', status: 'configurable_base_template',
    description: 'Caja pequeña con 1–3 cajones.',
    defaults: d({ widthMm: 500, heightMm: 550, depthMm: 400, front: 'drawers', drawerCount: 2, shelvesPerBay: 0, baseType: 'plinth', baseHeightMm: 60 }),
    pendingRules: [],
  },
  {
    id: 'desk', name: 'Escritorio', category: 'office', geometryStrategy: 'desk', status: 'verified_vertical',
    description: 'Cubierta, costados tipo panel y faldón; o cubierta sobre bastidor de PTR (requiere validación de cargas).',
    defaults: d({ widthMm: 1400, heightMm: 750, depthMm: 600, front: 'open', shelvesPerBay: 0 }),
    pendingRules: [],
  },
  {
    id: 'credenza', name: 'Credenza / aparador', category: 'office', geometryStrategy: 'box', status: 'configurable_base_template',
    description: 'Caja baja ancha con puertas.',
    defaults: d({ widthMm: 1600, heightMm: 750, depthMm: 450, shelvesPerBay: 1, baseType: 'levelers', baseHeightMm: 50 }),
    pendingRules: [],
  },
  {
    id: 'filing_cabinet', name: 'Archivero modular', category: 'office', geometryStrategy: 'box', status: 'configurable_base_template',
    description: 'Caja con cajones de archivo; requiere correderas de extensión total para carga de archivo.',
    defaults: d({ widthMm: 500, heightMm: 1000, depthMm: 550, front: 'drawers', drawerCount: 3, shelvesPerBay: 0 }),
    pendingRules: ['Herraje de folder colgante y bloqueo antivuelco por cajón pendientes.'],
  },
  {
    id: 'tv_console', name: 'Mueble de TV', category: 'living', geometryStrategy: 'box', status: 'configurable_base_template',
    description: 'Caja baja abierta o con puertas; versión flotante requiere anclaje calculado.',
    defaults: d({ widthMm: 1600, heightMm: 500, depthMm: 400, front: 'open', shelvesPerBay: 1 }),
    pendingRules: ['Pasacables y ventilación de equipos pendientes.'],
  },
  {
    id: 'bookcase', name: 'Librero', category: 'living', geometryStrategy: 'box', status: 'configurable_base_template',
    description: 'Caja alta abierta con entrepaños; anclaje antivuelco.',
    defaults: d({ widthMm: 900, heightMm: 2000, depthMm: 350, front: 'open', shelvesPerBay: 5, baseType: 'plinth', baseHeightMm: 60 }),
    pendingRules: ['Carga de libros: validar luz libre y flecha de entrepaño con el espesor real.'],
  },
  {
    id: 'bath_vanity', name: 'Gabinete de baño', category: 'bath', geometryStrategy: 'box', status: 'configurable_base_template',
    description: 'Caja con puertas; usar tablero resistente a humedad (RH).',
    defaults: d({ widthMm: 800, heightMm: 650, depthMm: 480, mount: 'wall' }),
    pendingRules: ['Recortes para sifón y lavabo no se calculan.', 'Usar tablero RH; el catálogo de material lo debe confirmar.'],
  },
  {
    id: 'laundry', name: 'Mueble de lavandería', category: 'service', geometryStrategy: 'box', status: 'configurable_base_template',
    description: 'Caja alta con puertas para servicio.',
    defaults: d({ widthMm: 800, heightMm: 1800, depthMm: 550, shelvesPerBay: 3, baseType: 'levelers', baseHeightMm: 100 }),
    pendingRules: ['Humedad y productos químicos: validar material y cantos.'],
  },
  {
    id: 'shoe_cabinet', name: 'Zapatera', category: 'service', geometryStrategy: 'box', status: 'configurable_base_template',
    description: 'Caja con entrepaños poco profundos.',
    defaults: d({ widthMm: 800, heightMm: 1200, depthMm: 350, shelvesPerBay: 4, baseType: 'plinth', baseHeightMm: 60 }),
    pendingRules: ['Entrepaños inclinados y ventilación pendientes.'],
  },
  {
    id: 'display', name: 'Exhibidor comercial', category: 'commercial', geometryStrategy: 'composite', status: 'template_requires_engine_validation',
    description: 'Exhibidor abierto; se aproxima como caja abierta.',
    defaults: d({ widthMm: 1200, heightMm: 1800, depthMm: 450, front: 'open', shelvesPerBay: 4, baseType: 'plinth', baseHeightMm: 80 }),
    pendingRules: ['Iluminación, vidrio y cargas comerciales pendientes.'],
  },
  {
    id: 'counter', name: 'Mostrador', category: 'commercial', geometryStrategy: 'composite', status: 'template_requires_engine_validation',
    description: 'Mostrador; se aproxima como caja con frente cerrado.',
    defaults: d({ widthMm: 1800, heightMm: 1050, depthMm: 600, front: 'open', shelvesPerBay: 1, baseType: 'plinth', baseHeightMm: 100 }),
    pendingRules: ['Panel frontal decorativo, cubierta en voladizo y uso intensivo pendientes.'],
  },
  {
    id: 'custom', name: 'Personalizado', category: 'custom', geometryStrategy: 'composite', status: 'template_requires_engine_validation',
    description: 'Composición libre basada en la caja genérica.',
    defaults: d({ widthMm: 800, heightMm: 800, depthMm: 450, front: 'open' }),
    pendingRules: ['Cualquier regla no expresada por la caja genérica debe validarse manualmente.'],
  },
];

export const CATEGORY_LABELS: Record<FamilyDefinition['category'], string> = {
  kitchen: 'Cocina', bedroom: 'Recámara', office: 'Oficina', living: 'Sala', bath: 'Baño', service: 'Servicios', commercial: 'Comercial', custom: 'A medida',
};

export const FAMILY_STATUS_LABELS: Record<FamilyDefinition['status'], string> = {
  verified_vertical: 'Implementación verificada con pruebas',
  configurable_base_template: 'Plantilla configurable (motor de caja genérico)',
  template_requires_engine_validation: 'Plantilla aproximada: requiere motor específico',
};
