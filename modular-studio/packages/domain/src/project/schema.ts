import { z } from 'zod';
import type { Catalog } from '../catalog';
import { SCHEMA_VERSION, type Project, type SupplierOffer } from '../types';
import { createModule, defaultPricing } from './factory';

const mm = z.number().finite();
const posMm = z.number().finite().positive();
const cents = z.number().int().nonnegative();

export const ModuleSpecSchema = z.object({
  id: z.string().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/, 'ID con letras, números, guion o guion bajo'),
  label: z.string().max(120),
  familyId: z.string().min(1),
  widthMm: posMm.max(6000),
  heightMm: posMm.max(4000),
  depthMm: posMm.max(2000),
  thicknessMm: posMm.max(60),
  materialId: z.string().min(1),
  backMaterialId: z.string().min(1).nullable(),
  finishId: z.string().min(1),
  edgeBandId: z.string().min(1),
  edgePolicy: z.enum(['front_visible_only', 'all_visible', 'none']),
  construction: z.enum(['top_bottom_between_sides', 'sides_between_top_bottom']),
  front: z.enum(['open', 'doors', 'drawers']),
  doorCount: z.number().int().min(1).max(8).nullable(),
  drawerCount: z.number().int().min(0).max(10),
  shelvesPerBay: z.number().int().min(0).max(12),
  dividerCount: z.number().int().min(0).max(10).nullable(),
  baseType: z.enum(['none', 'plinth', 'levelers', 'steel_frame']),
  baseHeightMm: mm.min(0).max(400),
  mount: z.enum(['floor', 'wall']),
  joinery: z.enum(['cam', 'dowel', 'screw', 'mixed']),
  hingeProductId: z.string().nullable(),
  slideProductId: z.string().nullable(),
  handleProductId: z.string().nullable(),
  steel: z.object({
    enabled: z.boolean(),
    profileId: z.string(),
    legHeightMm: mm.min(0),
    finish: z.enum(['primer', 'powder_coating', 'paint', 'none']),
  }),
  revealMm: mm.min(0).max(20),
  frontGapMm: mm.min(0).max(20),
});

export const PricingSchema = z.object({
  mode: z.enum(['margin', 'markup']),
  marginPct: z.number().min(0).lt(100, 'El margen sobre venta debe ser menor a 100 %'),
  markupPct: z.number().min(0).max(1000),
  taxRatePct: z.number().min(0).max(100),
  edgeWastePct: z.number().min(0).max(100),
  edgeAllowancePerSegmentMm: mm.min(0).max(200),
  steelWastePct: z.number().min(0).max(100),
  allowEstimatedPrices: z.boolean(),
  selectedOffers: z.record(z.string(), z.string()),
  manualCosts: z.array(z.object({
    key: z.string(), label: z.string(), applies: z.boolean(), amountCents: cents.nullable(), taxIncluded: z.boolean(), notes: z.string().optional(),
  })),
});

export const ProjectSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(160),
  customer: z.string().max(160),
  site: z.string().max(240),
  currency: z.literal('MXN'),
  unit: z.literal('mm'),
  createdAt: z.string(),
  updatedAt: z.string(),
  modules: z.array(ModuleSpecSchema).max(60),
  pricing: PricingSchema,
  cut: z.object({ kerfMm: mm.min(0).max(10), trimMarginMm: mm.min(0).max(50) }),
  inspection: z.object({
    checklist: z.record(z.string(), z.boolean()),
    diagonals: z.record(z.string(), z.object({ d1Mm: z.number().nullable(), d2Mm: z.number().nullable() })),
    diagonalToleranceMm: mm.min(0).max(20),
    notes: z.string().max(4000),
  }),
  approval: z.object({ approvedBy: z.string().max(120), approvedAt: z.string(), validationEvidence: z.string().max(4000) }).nullable(),
  status: z.enum(['DRAFT_NOT_RELEASED_FOR_MANUFACTURING', 'RELEASED_WITH_APPROVAL']),
});

export const SupplierOfferSchema = z.object({
  id: z.string().min(1),
  supplierId: z.string().min(1),
  productKey: z.string().min(1),
  sku: z.string().min(1),
  description: z.string(),
  packQuantity: z.number().positive(),
  purchaseUnit: z.string().min(1),
  currency: z.literal('MXN'),
  priceCents: cents.nullable(),
  taxIncluded: z.boolean().nullable(),
  taxRatePct: z.number().min(0).max(100).nullable(),
  priceStatus: z.enum(['PUBLICADO_VERIFICADO', 'COTIZADO', 'CAPTURADO_MANUAL', 'ESTIMADO', 'PENDIENTE', 'VENCIDO']),
  verifiedAt: z.string().nullable(),
  validUntil: z.string().nullable(),
  sourceUrl: z.string().url().nullable(),
  quoteReference: z.string().nullable(),
  available: z.boolean().nullable(),
  reliability: z.enum(['alta', 'media', 'baja']),
  capturedBy: z.string().nullable(),
  notes: z.string(),
}).superRefine((o, ctx) => {
  if (o.priceStatus === 'PENDIENTE' && o.priceCents !== null) ctx.addIssue({ code: 'custom', message: 'Una oferta PENDIENTE no lleva precio.' });
  if (o.priceStatus !== 'PENDIENTE' && o.priceCents === null) ctx.addIssue({ code: 'custom', message: 'Precio requerido salvo estado PENDIENTE (precio en blanco ≠ $0).' });
  if (o.priceStatus === 'PUBLICADO_VERIFICADO' && (!o.sourceUrl || !o.verifiedAt)) ctx.addIssue({ code: 'custom', message: 'PUBLICADO_VERIFICADO requiere URL de fuente y fecha de verificación.' });
  if (o.priceStatus === 'COTIZADO' && !o.quoteReference) ctx.addIssue({ code: 'custom', message: 'COTIZADO requiere folio/archivo de cotización.' });
  if (o.priceStatus === 'CAPTURADO_MANUAL' && !o.capturedBy) ctx.addIssue({ code: 'custom', message: 'CAPTURADO_MANUAL requiere autor de la captura.' });
  if (o.taxIncluded === true && o.taxRatePct === null) ctx.addIssue({ code: 'custom', message: 'Precio con IVA incluido requiere tasa de IVA.' });
});

export class ProjectValidationError extends Error {
  constructor(readonly issues: { path: string; message: string }[]) {
    super(`Proyecto inválido: ${issues.map((i) => `${i.path}: ${i.message}`).join('; ')}`);
  }
}

export function parseProject(raw: unknown): Project {
  const res = ProjectSchema.safeParse(raw);
  if (!res.success) throw new ProjectValidationError(res.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  return res.data as Project;
}

export function parseOffer(raw: unknown): SupplierOffer {
  const res = SupplierOfferSchema.safeParse(raw);
  if (!res.success) throw new ProjectValidationError(res.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })));
  return res.data as SupplierOffer;
}

/**
 * Migración explícita desde el esquema mínimo del paquete (03_DATOS/proyecto_ejemplo.json,
 * con `assemblies`). Un proyecto ya en el esquema vigente se devuelve sin cambios de geometría.
 */
export function migrateProject(raw: unknown, catalog: Catalog, now: string): { project: Project; migrated: boolean; notes: string[] } {
  if (raw && typeof raw === 'object' && 'modules' in raw) return { project: parseProject(raw), migrated: false, notes: [] };
  const legacy = raw as {
    id?: string; projectName?: string; assemblies?: Array<Record<string, unknown>>;
    pricing?: { targetMarginPct?: number; taxRatePct?: number };
  };
  if (!legacy || !Array.isArray(legacy.assemblies)) throw new ProjectValidationError([{ path: 'assemblies', message: 'Formato no reconocido' }]);
  const notes: string[] = ['Migrado desde esquema mínimo 1.0.0 (assemblies → modules).'];
  const modules = legacy.assemblies.map((a, i) => {
    const familyId = String(a.familyId ?? 'custom');
    const known = catalog.families.some((f) => f.id === familyId);
    const m = createModule(known ? familyId : 'custom', catalog, `M${String(i + 1).padStart(2, '0')}`);
    if (!known) notes.push(`Familia desconocida "${familyId}" → custom.`);
    const doors = Number(a.doorCount ?? 0), drawers = Number(a.drawerCount ?? 0);
    const back = a.backPanel as { enabled?: boolean } | undefined;
    return {
      ...m,
      label: String(a.id ?? m.label),
      widthMm: Number(a.widthMm), heightMm: Number(a.heightMm), depthMm: Number(a.depthMm), thicknessMm: Number(a.thicknessMm),
      materialId: catalog.materials.some((x) => x.id === a.materialId) ? String(a.materialId) : m.materialId,
      construction: a.constructionStrategy === 'sides_between_top_bottom' ? 'sides_between_top_bottom' as const : 'top_bottom_between_sides' as const,
      backMaterialId: back && back.enabled === false ? null : m.backMaterialId,
      front: drawers > 0 ? 'drawers' as const : doors > 0 ? 'doors' as const : 'open' as const,
      doorCount: doors > 0 ? doors : null,
      drawerCount: drawers,
      shelvesPerBay: drawers > 0 || doors === 0 ? 0 : m.shelvesPerBay,
      baseType: 'none' as const, baseHeightMm: 0,
      edgePolicy: a.edgeBandPolicy === 'front_visible_only' ? 'front_visible_only' as const : m.edgePolicy,
    };
  });
  const pricing = defaultPricing();
  if (typeof legacy.pricing?.targetMarginPct === 'number') pricing.marginPct = legacy.pricing.targetMarginPct;
  if (typeof legacy.pricing?.taxRatePct === 'number') pricing.taxRatePct = legacy.pricing.taxRatePct;
  const project = parseProject({
    schemaVersion: SCHEMA_VERSION, id: String(legacy.id ?? 'migrado'), name: String(legacy.projectName ?? 'Proyecto migrado'),
    customer: '', site: '', currency: 'MXN', unit: 'mm', createdAt: now, updatedAt: now, modules, pricing,
    cut: { kerfMm: 4, trimMarginMm: 10 }, inspection: { checklist: {}, diagonals: {}, diagonalToleranceMm: 2, notes: '' },
    approval: null, status: 'DRAFT_NOT_RELEASED_FOR_MANUFACTURING',
  });
  return { project, migrated: true, notes };
}
