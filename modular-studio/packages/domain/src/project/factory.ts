import { catalogLookup, type Catalog } from '../catalog';
import { SCHEMA_VERSION, type ModuleSpec, type PricingSettings, type Project } from '../types';

export const DEFAULT_MANUAL_COSTS: PricingSettings['manualCosts'] = [
  { key: 'service:cutting', label: 'Servicio de corte (dimensionado)', applies: true, amountCents: null, taxIncluded: false },
  { key: 'service:edgebanding', label: 'Servicio de enchapado / canteado', applies: true, amountCents: null, taxIncluded: false },
  { key: 'service:labor', label: 'Mano de obra de armado', applies: true, amountCents: null, taxIncluded: false },
  { key: 'service:installation', label: 'Instalación en obra', applies: true, amountCents: null, taxIncluded: false },
  { key: 'service:transport', label: 'Transporte / logística', applies: true, amountCents: null, taxIncluded: false },
  { key: 'service:consumables', label: 'Consumibles (pegamento, lija, limpieza)', applies: true, amountCents: null, taxIncluded: false },
  { key: 'service:steel_fabrication', label: 'Fabricación de herrería (corte, soldadura, pintura)', applies: false, amountCents: null, taxIncluded: false },
];

export function defaultPricing(): PricingSettings {
  return {
    mode: 'margin',
    marginPct: 25,
    markupPct: 35,
    taxRatePct: 16,
    edgeWastePct: 10,
    edgeAllowancePerSegmentMm: 30,
    steelWastePct: 5,
    allowEstimatedPrices: false,
    selectedOffers: {},
    manualCosts: DEFAULT_MANUAL_COSTS.map((c) => ({ ...c })),
  };
}

/** Crea un módulo con los valores por defecto de la familia. */
export function createModule(familyId: string, catalog: Catalog, id: string, label?: string): ModuleSpec {
  const L = catalogLookup(catalog);
  const f = L.family(familyId);
  const wardrobe = f.geometryStrategy === 'wardrobe';
  return {
    id,
    label: label ?? f.name,
    familyId,
    widthMm: f.defaults.widthMm,
    heightMm: f.defaults.heightMm,
    depthMm: f.defaults.depthMm,
    thicknessMm: 18,
    materialId: familyId === 'bath_vanity' ? 'mel18rh' : 'mel18',
    backMaterialId: f.geometryStrategy === 'desk' ? null : wardrobe ? 'hdf6' : 'hdf3',
    finishId: 'grafito',
    edgeBandId: 'pvc19x045',
    edgePolicy: 'front_visible_only',
    construction: 'top_bottom_between_sides',
    front: f.defaults.front,
    doorCount: f.defaults.doorCount,
    drawerCount: f.defaults.drawerCount,
    shelvesPerBay: f.defaults.shelvesPerBay,
    dividerCount: null,
    baseType: f.defaults.baseType,
    baseHeightMm: f.defaults.baseHeightMm,
    mount: f.defaults.mount,
    joinery: 'cam',
    hingeProductId: null,
    slideProductId: null,
    handleProductId: null,
    steel: { enabled: false, profileId: 'ptr1x1c14', legHeightMm: 100, finish: 'powder_coating' },
    revealMm: 2,
    frontGapMm: 3,
  };
}

export interface NewProjectInput {
  id: string;
  name: string;
  familyId: string;
  customer?: string;
  site?: string;
  now: string;
}

export function createProject(input: NewProjectInput, catalog: Catalog): Project {
  return {
    schemaVersion: SCHEMA_VERSION,
    id: input.id,
    name: input.name,
    customer: input.customer ?? '',
    site: input.site ?? '',
    currency: 'MXN',
    unit: 'mm',
    createdAt: input.now,
    updatedAt: input.now,
    modules: [createModule(input.familyId, catalog, 'M01')],
    pricing: defaultPricing(),
    cut: { kerfMm: 4, trimMarginMm: 10 },
    inspection: { checklist: {}, diagonals: {}, diagonalToleranceMm: 2, notes: '' },
    approval: null,
    status: 'DRAFT_NOT_RELEASED_FOR_MANUFACTURING',
  };
}

/** Siguiente ID de módulo estable (M01, M02…), sin reutilizar IDs existentes. */
export function nextModuleId(project: Project): string {
  let max = 0;
  for (const m of project.modules) {
    const n = /^M(\d+)$/.exec(m.id);
    if (n) max = Math.max(max, Number(n[1]));
  }
  return `M${String(max + 1).padStart(2, '0')}`;
}
