import { catalogLookup, type Catalog, type CatalogLookup } from '../catalog';
import type { EdgeName, FamilyDefinition, MaterialDefinition, ModuleResult, ModuleSpec, SteelRequirement } from '../types';
import { box, ModuleBuilder, overlapVolume, r2 } from './helpers';

/** Parámetros constructivos configurables del motor (no son normas universales). */
export const ENGINE_DEFAULTS = {
  maxDoorWidthMm: 600,
  shelfSideClearanceMm: 2,
  shelfBackClearanceMm: 5,
  drawerRearClearanceMm: 10,
  drawerBoxHeightDeductionMm: 40,
  drawerBottomThicknessMm: 6,
  hatShelfGapMm: 350,
  railBelowShelfMm: 50,
  plinthSetbackMm: 40,
  tallUnitAntiTipMm: 1200,
  drawerUnitAntiTipMm: 600,
  backScrewSpacingMm: 150,
  deskMaxModestyMm: 280,
  deskMinKneeClearanceMm: 620,
  deskMinLegroomWidthMm: 600,
};

export class ModuleInputError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

/** Calcula piezas, herrajes, mecanizados, herrería e incidencias de un módulo. Función pura. */
export function calculateModule(spec: ModuleSpec, catalog: Catalog, offsetXMm = 0): ModuleResult {
  const L = catalogLookup(catalog);
  const family = L.family(spec.familyId);
  const material = L.material(spec.materialId);
  const b = new ModuleBuilder(spec.id, spec.finishId, spec.edgePolicy === 'none' ? null : spec.edgeBandId);
  const result = (fabricable: boolean, extra: Partial<ModuleResult> = {}): ModuleResult => ({
    moduleId: spec.id, offsetXMm, offsetYMm: 0, fabricable,
    parts: b.parts, hardware: b.hardware, machining: b.machining, steel: [], issues: b.issues,
    theoreticalDiagonalMm: null, carcassDepthMm: null, overallHeightMm: spec.heightMm, ...extra,
  });

  const { widthMm: W, heightMm: H, depthMm: D, thicknessMm: T } = spec;
  const nums = { W, H, D, T, baseHeight: spec.baseHeightMm, reveal: spec.revealMm, gap: spec.frontGapMm };
  for (const [k, v] of Object.entries(nums)) {
    if (!Number.isFinite(v) || v < 0 || (['W', 'H', 'D', 'T'].includes(k) && v === 0)) {
      b.issue({ code: 'INVALID_NUMBER', severity: 'error', message: `Valor inválido para ${k}: ${v}. Todas las medidas deben ser números positivos en mm.` });
      return result(false);
    }
  }
  if (W <= 2 * T) {
    b.issue({ code: 'WIDTH_BELOW_DOUBLE_THICKNESS', severity: 'error', message: `Ancho ${W} mm ≤ 2 × espesor (${2 * T} mm): no existe plan fabricable.` });
    return result(false);
  }
  if (H <= 2 * T) {
    b.issue({ code: 'HEIGHT_BELOW_DOUBLE_THICKNESS', severity: 'error', message: `Alto ${H} mm ≤ 2 × espesor (${2 * T} mm): no existe plan fabricable.` });
    return result(false);
  }
  if (material.thicknessMm !== T) {
    b.issue({ code: 'THICKNESS_MATERIAL_MISMATCH', severity: 'warning', message: `El espesor de cálculo (${T} mm) difiere del nominal del material ${material.name} (${material.thicknessMm} mm). Medir espesor real.` });
  }
  if (material.kind === 'solidwood') {
    b.issue({ code: 'SOLID_WOOD_REVIEW', severity: 'blocker', message: 'Madera maciza: medidas orientativas; rediseñar uniones y permitir movimiento higroscópico antes de liberar.' });
  }
  familyIssues(family, b);
  if (spec.edgePolicy === 'none') {
    b.issue({ code: 'EDGE_VISIBLE_UNBANDED', severity: 'warning', message: 'Política sin tapacanto: los cantos visibles quedarán expuestos (riesgo de humedad y despostillado).' });
  }

  const ctx: Ctx = { spec, catalog, L, family, material, b };
  let extra: Partial<ModuleResult>;
  try {
    extra = family.geometryStrategy === 'desk' ? buildDesk(ctx) : buildBox(ctx);
  } catch (e) {
    if (e instanceof ModuleInputError) {
      b.issue({ code: e.code, severity: 'error', message: e.message });
      return result(false);
    }
    throw e;
  }

  checkSheetFit(ctx);
  checkCollisions(b);
  const fabricable = !b.issues.some((i) => i.severity === 'error');
  return result(fabricable, extra);
}

interface Ctx {
  spec: ModuleSpec;
  catalog: Catalog;
  L: CatalogLookup;
  family: FamilyDefinition;
  material: MaterialDefinition;
  b: ModuleBuilder;
}

function familyIssues(family: FamilyDefinition, b: ModuleBuilder) {
  if (family.status === 'template_requires_engine_validation') {
    b.issue({ code: 'TEMPLATE_REQUIRES_ENGINE_VALIDATION', severity: 'blocker', message: `${family.name}: plantilla aproximada con el motor de caja genérico; requiere motor/reglas específicas y revisión de ingeniería.` });
  } else if (family.status === 'configurable_base_template') {
    b.issue({ code: 'TEMPLATE_GENERIC_RULES', severity: 'info', message: `${family.name}: plantilla configurable sobre el motor de caja genérico; reglas propias de la familia por validar.` });
  }
  for (const rule of family.pendingRules) b.issue({ code: 'FAMILY_RULE_PENDING', severity: 'warning', message: `${family.name}: ${rule}` });
}

/** Conectores por unión según profundidad (orientativo, editable). */
function connectorsPerJoint(depth: number): number {
  return depth <= 400 ? 2 : depth <= 700 ? 3 : 4;
}

function joineryHardware(ctx: Ctx, joints: number, depth: number, targetParts: { partId: string; joints: number }[]) {
  const { spec, L, b } = ctx;
  const k = connectorsPerJoint(depth);
  const n = joints * k;
  const basis = `${joints} uniones × ${k} conectores (profundidad ${r2(depth)} mm); cantidad orientativa`;
  const cam = L.hardware('cam-minifix15');
  const dowel = L.hardware('dowel-8x35');
  const screw = L.hardware('screw-4x40');
  if (spec.joinery === 'cam' || spec.joinery === 'mixed') {
    b.hw({ category: 'cam_connector', productId: cam.id, productKey: cam.productKey, description: cam.name, quantity: n, unit: cam.unit, basis, validationStatus: cam.validationStatus });
    const pattern = L.pattern(cam.machiningPatternId!);
    for (const t of targetParts) {
      const part = b.parts.find((p) => p.id === t.partId);
      if (part) b.machine(pattern, part, (t.joints * k) / part.quantity, 'Excéntrico + perno', cam.id);
    }
  }
  if (spec.joinery === 'dowel' || spec.joinery === 'mixed' || spec.joinery === 'cam') {
    b.hw({ category: 'dowel', productId: dowel.id, productKey: dowel.productKey, description: dowel.name, quantity: n, unit: dowel.unit, basis: `${basis}; taquete de alineación`, validationStatus: dowel.validationStatus });
  }
  if (spec.joinery === 'screw') {
    b.hw({ category: 'screw', productId: screw.id, productKey: screw.productKey, description: screw.name, quantity: n, unit: screw.unit, basis, validationStatus: screw.validationStatus });
  }
}

function edgesFor(spec: ModuleSpec, kind: 'carcass_front' | 'front' | 'shelf' | 'back' | 'side'): EdgeName[] {
  if (spec.edgePolicy === 'none') return [];
  switch (kind) {
    case 'front': return ['L1', 'L2', 'A1', 'A2'];
    case 'back': return [];
    case 'shelf': return spec.backMaterialId ? ['L1'] : ['L1', 'L2'];
    case 'side': {
      const e: EdgeName[] = ['L1'];
      if (spec.edgePolicy === 'all_visible') {
        if (spec.construction === 'top_bottom_between_sides') e.push('A2');
        if (spec.mount === 'wall' && spec.construction === 'top_bottom_between_sides') e.push('A1');
        if (!spec.backMaterialId) e.push('L2');
      }
      return e;
    }
    case 'carcass_front': {
      const e: EdgeName[] = ['L1'];
      if (spec.edgePolicy === 'all_visible' && spec.construction === 'sides_between_top_bottom') e.push('A1', 'A2');
      return e;
    }
  }
}

// ---------------------------------------------------------------------------
// Caja genérica (gabinetes, alacenas, clósets, libreros, etc.)
// ---------------------------------------------------------------------------

function buildBox(ctx: Ctx): Partial<ModuleResult> {
  const { spec, L, b, material, family } = ctx;
  const { widthMm: W, heightMm: H, depthMm: D, thicknessMm: T } = spec;
  const isWardrobe = family.geometryStrategy === 'wardrobe';
  const backMat = spec.backMaterialId ? L.material(spec.backMaterialId) : null;
  const B = backMat?.thicknessMm ?? 0;
  const frontT = spec.front === 'open' ? 0 : T;
  const cd = D - B - frontT;
  if (cd < 100) throw new ModuleInputError('DEPTH_INSUFFICIENT', `Profundidad de caja ${r2(cd)} mm (fondo ${D} − respaldo ${B} − frente ${frontT}) insuficiente para fabricar.`);

  const baseH = spec.baseType === 'none' ? 0 : spec.baseHeightMm;
  const zb = baseH;
  const y0 = frontT, y1 = frontT + cd;
  const IW = W - 2 * T;
  const IH = H - 2 * T;
  const iz0 = zb + T, iz1 = zb + H - T;
  const grain = 'length' as const;

  // Costados y horizontales
  if (spec.construction === 'top_bottom_between_sides') {
    b.part({ code: 'SIDE', name: 'Costado (izq./der.)', role: 'carcass', lengthMm: H, widthMm: cd, thicknessMm: T, grainAxis: grain, edges: edgesFor(spec, 'side'), materialId: material.id,
      placements: [box(0, T, y0, y1, zb, zb + H), box(W - T, W, y0, y1, zb, zb + H)] });
    b.part({ code: 'HORIZONTAL', name: 'Tapa y piso (entre costados)', role: 'carcass', lengthMm: IW, widthMm: cd, thicknessMm: T, grainAxis: grain, edges: edgesFor(spec, 'carcass_front'), materialId: material.id,
      placements: [box(T, W - T, y0, y1, zb, zb + T), box(T, W - T, y0, y1, zb + H - T, zb + H)] });
  } else {
    b.part({ code: 'HORIZONTAL', name: 'Tapa y piso (sobre costados)', role: 'carcass', lengthMm: W, widthMm: cd, thicknessMm: T, grainAxis: grain, edges: edgesFor(spec, 'carcass_front'), materialId: material.id,
      placements: [box(0, W, y0, y1, zb, zb + T), box(0, W, y0, y1, zb + H - T, zb + H)] });
    b.part({ code: 'SIDE', name: 'Costado (entre tapa y piso)', role: 'carcass', lengthMm: IH, widthMm: cd, thicknessMm: T, grainAxis: grain, edges: edgesFor(spec, 'side'), materialId: material.id,
      placements: [box(0, T, y0, y1, iz0, iz1), box(W - T, W, y0, y1, iz0, iz1)] });
  }

  // Respaldo sobrepuesto
  if (backMat) {
    b.part({ code: 'BACK', name: `Respaldo sobrepuesto ${backMat.name}`, role: 'back', lengthMm: H, widthMm: W, thicknessMm: B, grainAxis: 'none', edges: [], materialId: backMat.id,
      placements: [box(0, W, y1, y1 + B, zb, zb + H)], notes: ['Sobrepuesto en cara posterior; fija la escuadra de la caja.'] });
    const perimeter = 2 * (W + H);
    const screws = Math.ceil(perimeter / ENGINE_DEFAULTS.backScrewSpacingMm);
    const spax = L.hardware('screw-spax-4x15');
    b.hw({ category: 'screw', productId: spax.id, productKey: spax.productKey, description: `${spax.name} — fijación de respaldo`, quantity: screws, unit: spax.unit, basis: `perímetro ${perimeter} mm / ${ENGINE_DEFAULTS.backScrewSpacingMm} mm de paso (orientativo)`, validationStatus: 'pending_validation' });
  } else {
    b.issue({ code: 'NO_BACK_PANEL', severity: 'warning', message: 'Sin respaldo: la caja requiere otro medio de rigidización/escuadra (travesaños, fijación a muro).' });
  }

  // Divisores
  const maxSpan = material.maxShelfSpanMm ?? 800;
  let dividers = spec.dividerCount ?? Math.max(0, Math.ceil(IW / maxSpan) - 1);
  if (spec.front === 'drawers' && dividers > 0) {
    b.issue({ code: 'DRAWERS_WITH_DIVIDERS', severity: 'warning', message: 'Los frentes de cajón ocupan todo el ancho: se omiten divisores. Divida en módulos si se requieren columnas.' });
    dividers = 0;
  }
  const bays = dividers + 1;
  const bayW = (IW - dividers * T) / bays;
  if (bayW < 100) throw new ModuleInputError('BAY_TOO_NARROW', `Hueco interior de ${r2(bayW)} mm: demasiados divisores para el ancho.`);
  const bayX0 = (i: number) => T + i * (bayW + T);
  if (dividers > 0) {
    b.part({ code: 'DIVIDER', name: 'Divisor vertical', role: 'divider', lengthMm: IH, widthMm: cd, thicknessMm: T, grainAxis: grain, edges: edgesFor(spec, 'side').slice(0, 1), materialId: material.id,
      placements: Array.from({ length: dividers }, (_, i) => box(bayX0(i) + bayW, bayX0(i) + bayW + T, y0, y1, iz0, iz1)),
      notes: spec.dividerCount === null ? [`Divisores automáticos por luz libre orientativa de ${maxSpan} mm del material.`] : [] });
  }
  if (bayW > maxSpan) {
    b.issue({ code: 'SHELF_SPAN_EXCEEDED', severity: 'warning', message: `Luz libre de ${r2(bayW)} mm supera la orientativa de ${maxSpan} mm para ${material.name}: riesgo de flecha en entrepaños/tapa. Validar carga o agregar divisor.` });
  }

  // Unión de caja: 4 uniones + 2 por divisor
  const joints = 4 + dividers * 2;
  const horizontalId = `${spec.id}-HORIZONTAL`;
  joineryHardware(ctx, joints, cd, [{ partId: horizontalId, joints: 4 }, ...(dividers ? [{ partId: `${spec.id}-DIVIDER`, joints: dividers * 2 }] : [])]);

  // Entrepaños / clóset
  const shelfLen = bayW - ENGINE_DEFAULTS.shelfSideClearanceMm;
  const shelfDepth = cd - ENGINE_DEFAULTS.shelfBackClearanceMm;
  const shelfPlacements: ReturnType<typeof box>[] = [];
  const shelfPin = L.hardware('shelf-pin-5');
  const railSegments: number[] = [];
  const sc = ENGINE_DEFAULTS.shelfSideClearanceMm / 2;
  if (spec.front !== 'drawers') {
    if (isWardrobe) {
      const tower = bays >= 2 && spec.shelvesPerBay > 1 ? bays - 1 : -1;
      for (let i = 0; i < bays; i++) {
        const x0 = bayX0(i) + sc, x1 = bayX0(i) + bayW - sc;
        if (i === tower) {
          for (const z of evenZ(iz0, iz1, spec.shelvesPerBay, T)) shelfPlacements.push(box(x0, x1, y0, y0 + shelfDepth, z, z + T));
          continue;
        }
        let railZ = iz1 - 60;
        const hatZ = iz1 - ENGINE_DEFAULTS.hatShelfGapMm - T;
        if (spec.shelvesPerBay >= 1 && hatZ < iz0 + 300) {
          b.issue({ code: 'HAT_SHELF_SKIPPED', severity: 'warning', message: `Hueco ${i + 1}: alto insuficiente para maletero a ${ENGINE_DEFAULTS.hatShelfGapMm} mm de la tapa.` });
        } else if (spec.shelvesPerBay >= 1) {
          const z = hatZ;
          shelfPlacements.push(box(x0, x1, y0, y0 + shelfDepth, z, z + T));
          railZ = z - ENGINE_DEFAULTS.railBelowShelfMm;
        }
        railSegments.push(bayW);
        if (railZ - zb < 1000) b.issue({ code: 'HANGING_HEIGHT_LOW', severity: 'warning', message: `Hueco ${i + 1}: tubo de colgar a ${r2(railZ)} mm del piso; ropa larga requiere ≥1600 mm, camisas ≥1000 mm.` });
      }
    } else {
      for (let i = 0; i < bays; i++) {
        for (const z of evenZ(iz0, iz1, spec.shelvesPerBay, T)) shelfPlacements.push(box(bayX0(i) + sc, bayX0(i) + bayW - sc, y0, y0 + shelfDepth, z, z + T));
      }
    }
  }
  if (shelfPlacements.length) {
    const shelf = b.part({ code: 'SHELF', name: 'Entrepaño móvil', role: 'shelf', lengthMm: shelfLen, widthMm: shelfDepth, thicknessMm: T, grainAxis: grain, edges: edgesFor(spec, 'shelf'), materialId: material.id,
      placements: shelfPlacements, notes: [`Holgura ${ENGINE_DEFAULTS.shelfSideClearanceMm} mm en ancho y ${ENGINE_DEFAULTS.shelfBackClearanceMm} mm en fondo (nominal).`] });
    b.hw({ category: 'shelf_pin', productId: shelfPin.id, productKey: shelfPin.productKey, description: shelfPin.name, quantity: shelf.quantity * 4, unit: shelfPin.unit, basis: `${shelf.quantity} entrepaños × 4 soportes`, validationStatus: shelfPin.validationStatus });
    const side = b.parts.find((p) => p.code === 'SIDE')!;
    // Por costado: 2 barrenos por cada entrepaño del hueco adyacente (aplica a cada unidad del modelo).
    b.machine(L.pattern('shelf-pin-line-32'), side, 2 * Math.max(1, Math.round(shelf.quantity / bays)), 'Barreno para soporte de entrepaño', shelfPin.id);
  }
  if (railSegments.length) {
    const rail = L.hardware('hanging-rail-oval');
    const sup = L.hardware('hanging-rail-support');
    const total = railSegments.reduce((s, x) => s + x - 2, 0);
    b.hw({ category: 'hanging_rail', productId: rail.id, productKey: rail.productKey, description: rail.name, quantity: r2(total / 1000), unit: 'm', basis: `${railSegments.length} tramos de (hueco − 2 mm)`, validationStatus: rail.validationStatus });
    b.hw({ category: 'hanging_rail_support', productId: sup.id, productKey: sup.productKey, description: sup.name, quantity: railSegments.length * 2, unit: sup.unit, basis: '2 soportes por tramo', validationStatus: sup.validationStatus });
  }

  // Frentes
  if (spec.front === 'doors') buildDoors(ctx, zb, dividers);
  if (spec.front === 'drawers') buildDrawers(ctx, zb, cd, y0);

  // Base / zoclo / herrería
  const steel: SteelRequirement[] = [];
  buildBase(ctx, cd, y0, steel);

  // Montaje y antivuelco
  mountingHardware(ctx);

  return {
    theoreticalDiagonalMm: r2(Math.hypot(W, H)),
    carcassDepthMm: r2(cd),
    overallHeightMm: H + baseH,
    steel,
  };
}

/** Posiciones Z equiespaciadas para n entrepaños de espesor t entre z0 y z1. */
export function evenZ(z0: number, z1: number, n: number, t: number): number[] {
  if (n <= 0) return [];
  const free = (z1 - z0 - n * t) / (n + 1);
  return Array.from({ length: n }, (_, i) => r2(z0 + free * (i + 1) + t * i));
}

function buildDoors(ctx: Ctx, zb: number, dividers: number) {
  const { spec, L, b, material } = ctx;
  const { widthMm: W, heightMm: H, thicknessMm: T } = spec;
  const r = spec.revealMm, g = spec.frontGapMm;
  const n = spec.doorCount ?? Math.max(1, Math.ceil(W / ENGINE_DEFAULTS.maxDoorWidthMm));
  const dw = (W - 2 * r - (n - 1) * g) / n;
  const dh = H - 2 * r;
  if (dw < 100) throw new ModuleInputError('DOOR_TOO_NARROW', `Puertas de ${r2(dw)} mm: reduzca el número de hojas.`);
  const door = b.part({ code: 'DOOR', name: n === 1 ? 'Puerta sobrepuesta' : 'Puerta sobrepuesta (hoja)', role: 'front', lengthMm: dh, widthMm: dw, thicknessMm: T, grainAxis: 'length', edges: edgesFor(spec, 'front'), materialId: material.id,
    placements: Array.from({ length: n }, (_, i) => box(r + i * (dw + g), r + i * (dw + g) + dw, 0, T, zb + r, zb + r + dh)),
    notes: [`Holgura perimetral ${r} mm y ${g} mm entre hojas. Verificar solape con la bisagra elegida.`], validationStatus: 'pending_validation' });
  if (dw > ENGINE_DEFAULTS.maxDoorWidthMm) b.issue({ code: 'DOOR_TOO_WIDE', severity: 'warning', partId: door.id, message: `Puerta de ${r2(dw)} mm de ancho: verificar pandeo, peso y apertura segura.` });
  if (dividers > 0 && n % (dividers + 1) !== 0) b.issue({ code: 'DOOR_DIVIDER_MISALIGNED', severity: 'info', message: `${n} puertas con ${dividers} divisor(es): las juntas de las hojas no coinciden con los divisores.` });

  const hinge = L.maybeHardware(spec.hingeProductId) ?? L.hardware('hinge-generic-110');
  const rules = L.hingeRulesFor(hinge);
  const rule = rules.find((x) => dh <= x.maxDoorHeightMm);
  if (!rule) throw new ModuleInputError('DOOR_TOO_TALL', `Puerta de ${r2(dh)} mm excede la tabla de bisagras disponible (${rules.at(-1)?.maxDoorHeightMm ?? 0} mm).`);
  b.hw({ category: 'hinge', productId: hinge.id, productKey: hinge.productKey, description: hinge.name, quantity: n * rule.hingesPerDoor, unit: hinge.unit,
    basis: `${n} puertas × ${rule.hingesPerDoor} (alto ${r2(dh)} mm ≤ ${rule.maxDoorHeightMm}; tabla ${hinge.params?.hingeRules ? 'del producto' : 'orientativa'})`,
    validationStatus: hinge.technicalDatasheetUrl ? hinge.validationStatus : 'pending_validation' });
  b.issue({ code: 'HINGE_PENDING_VALIDATION', severity: 'warning', message: `Bisagras (${hinge.name}): cantidad y cazoleta pendientes de validar con ficha técnica del fabricante.` });
  if (hinge.machiningPatternId) b.machine(L.pattern(hinge.machiningPatternId), door, rule.hingesPerDoor, 'Cazoleta de bisagra', hinge.id);
  handles(ctx, n);
}

function handles(ctx: Ctx, n: number) {
  const h = ctx.L.maybeHardware(ctx.spec.handleProductId) ?? ctx.L.hardware('handle-generic');
  ctx.b.hw({ category: 'handle', productId: h.id, productKey: h.productKey, description: h.name, quantity: n, unit: h.unit, basis: '1 por frente', validationStatus: h.validationStatus });
}

function buildDrawers(ctx: Ctx, zb: number, cd: number, y0: number) {
  const { spec, L, b, material, catalog } = ctx;
  const { widthMm: W, heightMm: H, thicknessMm: T } = spec;
  const n = Math.max(1, Math.round(spec.drawerCount));
  const r = spec.revealMm, g = spec.frontGapMm;
  const fh = (H - 2 * r - (n - 1) * g) / n;
  if (fh < 80) throw new ModuleInputError('DRAWER_FRONT_TOO_LOW', `Frentes de cajón de ${r2(fh)} mm: demasiados cajones para el alto.`);
  const fronts = Array.from({ length: n }, (_, i) => box(r, W - r, 0, T, zb + r + i * (fh + g), zb + r + i * (fh + g) + fh));
  b.part({ code: 'DRAWER_FRONT', name: 'Frente de cajón sobrepuesto', role: 'front', lengthMm: W - 2 * r, widthMm: fh, thicknessMm: T, grainAxis: 'length', edges: edgesFor(spec, 'front'), materialId: material.id,
    placements: fronts, validationStatus: 'pending_validation' });
  handles(ctx, n);

  const slide = L.maybeHardware(spec.slideProductId);
  if (!slide) {
    const generic = L.hardware('slide-generic-telescopic');
    b.hw({ category: 'drawer_slide', productId: null, productKey: 'hw:slide_unselected', description: 'Corredera por seleccionar', quantity: n, unit: 'juego', basis: '1 juego por cajón', validationStatus: 'pending_validation' });
    b.issue({ code: 'DRAWER_SLIDE_NOT_SELECTED', severity: 'blocker', message: `Seleccione corredera (p. ej. "${generic.name}") para calcular la caja de cajón. No se calcula caja ni perforación sin ella.` });
    return;
  }
  b.hw({ category: 'drawer_slide', productId: slide.id, productKey: slide.productKey, description: slide.name, quantity: n, unit: slide.unit, basis: '1 juego por cajón', validationStatus: slide.validationStatus });
  const clearance = slide.params?.sideClearancePerSideMm;
  const lengths = slide.params?.nominalLengthsMm ?? [];
  if (clearance === undefined || lengths.length === 0) {
    b.issue({ code: 'DRAWER_SLIDE_PARAMS_MISSING', severity: 'blocker', message: `${slide.name}: faltan holgura lateral y/o largos nominales de la ficha técnica. Caja de cajón no calculada.` });
    return;
  }
  const maxLen = cd - ENGINE_DEFAULTS.drawerRearClearanceMm;
  const len = [...lengths].sort((a, c) => c - a).find((x) => x <= maxLen);
  if (len === undefined) throw new ModuleInputError('DRAWER_DEPTH_INSUFFICIENT', `Profundidad útil ${r2(maxLen)} mm menor que la corredera más corta (${Math.min(...lengths)} mm).`);
  const boxT = slide.params?.drawerBoxThicknessMm ?? 15;
  const boxMat = catalog.materials.find((m) => m.kind === 'board' && m.thicknessMm === boxT);
  if (!boxMat) throw new ModuleInputError('DRAWER_BOX_MATERIAL_MISSING', `No hay tablero de ${boxT} mm en catálogo para la caja de cajón.`);
  const bottomMat = catalog.materials.find((m) => m.kind === 'back_panel' && m.thicknessMm === ENGINE_DEFAULTS.drawerBottomThicknessMm) ?? null;
  const bt = bottomMat?.thicknessMm ?? ENGINE_DEFAULTS.drawerBottomThicknessMm;
  const bw = W - 2 * T - 2 * clearance;
  // Margen vertical entre frente y caja: deducción configurada o lo necesario para librar tapa/piso.
  const margin = Math.max(ENGINE_DEFAULTS.drawerBoxHeightDeductionMm / 2, T - r + 2);
  const bh = Math.min(fh - 2 * margin, 250);
  if (bw < 100 || bh < 60) throw new ModuleInputError('DRAWER_BOX_TOO_SMALL', `Caja de cajón ${r2(bw)} × ${r2(bh)} mm demasiado pequeña.`);
  const xs0 = T + clearance, xs1 = W - T - clearance;
  const sides: ReturnType<typeof box>[] = [], fbs: ReturnType<typeof box>[] = [], bottoms: ReturnType<typeof box>[] = [];
  for (const f of fronts) {
    const z0 = f.z0 + (fh - bh) / 2;
    const z1 = z0 + bh;
    bottoms.push(box(xs0, xs1, y0, y0 + len, z0, z0 + bt));
    sides.push(box(xs0, xs0 + boxT, y0, y0 + len, z0 + bt, z1), box(xs1 - boxT, xs1, y0, y0 + len, z0 + bt, z1));
    fbs.push(box(xs0 + boxT, xs1 - boxT, y0, y0 + boxT, z0 + bt, z1), box(xs0 + boxT, xs1 - boxT, y0 + len - boxT, y0 + len, z0 + bt, z1));
  }
  const note = [`Calculada con ${slide.name}: holgura ${clearance} mm/lado, largo ${len} mm. Validar con ficha técnica.`];
  b.part({ code: 'DRAWER_SIDE', name: 'Costado de caja de cajón', role: 'drawer_box', lengthMm: len, widthMm: bh - bt, thicknessMm: boxT, grainAxis: 'length', edges: spec.edgePolicy === 'none' ? [] : ['L1'], materialId: boxMat.id, placements: sides, notes: note, validationStatus: 'pending_validation' });
  b.part({ code: 'DRAWER_FB', name: 'Frente/trasera de caja de cajón', role: 'drawer_box', lengthMm: bw - 2 * boxT, widthMm: bh - bt, thicknessMm: boxT, grainAxis: 'length', edges: spec.edgePolicy === 'none' ? [] : ['L1'], materialId: boxMat.id, placements: fbs, notes: note, validationStatus: 'pending_validation' });
  b.part({ code: 'DRAWER_BOTTOM', name: 'Fondo de cajón sobrepuesto', role: 'drawer_box', lengthMm: len, widthMm: bw, thicknessMm: bt, grainAxis: 'none', edges: [], materialId: bottomMat?.id ?? 'hdf6', placements: bottoms, notes: note, validationStatus: 'pending_validation' });
  const side = b.parts.find((p) => p.code === 'SIDE')!;
  if (slide.machiningPatternId) b.machine(L.pattern(slide.machiningPatternId), side, n, 'Fijación de corredera', slide.id);
  b.issue({ code: 'DRAWER_BOX_PENDING_VALIDATION', severity: 'warning', message: 'Cajas de cajón calculadas con parámetros de corredera no verificados con ficha técnica.' });
}

function buildBase(ctx: Ctx, cd: number, y0: number, steel: SteelRequirement[]) {
  const { spec, L, b, material } = ctx;
  const { widthMm: W, thicknessMm: T } = spec;
  const h = spec.baseHeightMm;
  if (spec.baseType === 'none' || h <= 0) {
    if (spec.baseType !== 'none') b.issue({ code: 'BASE_HEIGHT_ZERO', severity: 'warning', message: 'Base seleccionada con altura 0 mm: se ignora.' });
    return;
  }
  if (spec.mount === 'wall') b.issue({ code: 'BASE_ON_WALL_UNIT', severity: 'warning', message: 'Módulo a muro con base/patas: confirmar si se apoya en piso.' });
  if (spec.baseType === 'levelers') {
    const lev = L.hardware('leveler-100');
    const count = W <= 1000 ? 4 : 6;
    b.hw({ category: 'leveler', productId: lev.id, productKey: lev.productKey, description: lev.name, quantity: count, unit: lev.unit, basis: `${count} por ancho ${W} mm (orientativo)`, validationStatus: lev.validationStatus });
    b.issue({ code: 'PLINTH_NOT_INCLUDED', severity: 'info', message: 'Patas niveladoras: zoclo frontal con clips no incluido en el despiece.' });
  }
  if (spec.baseType === 'plinth') {
    const s = ENGINE_DEFAULTS.plinthSetbackMm;
    const fy0 = y0 + s;
    const by1 = y0 + cd;
    const crossLen = by1 - fy0 - 2 * T;
    if (crossLen < 50) throw new ModuleInputError('PLINTH_TOO_SHALLOW', 'Profundidad insuficiente para el bastidor de zoclo.');
    b.part({ code: 'PLINTH_RAIL', name: 'Zoclo frontal / trasero', role: 'plinth', lengthMm: W, widthMm: h, thicknessMm: T, grainAxis: 'length', edges: spec.edgePolicy === 'none' ? [] : ['L1'], materialId: material.id,
      placements: [box(0, W, fy0, fy0 + T, 0, h), box(0, W, by1 - T, by1, 0, h)], notes: [`Zoclo remetido ${s} mm.`] });
    b.part({ code: 'PLINTH_CROSS', name: 'Travesaño de zoclo', role: 'plinth', lengthMm: crossLen, widthMm: h, thicknessMm: T, grainAxis: 'length', edges: [], materialId: material.id,
      placements: [box(0, T, fy0 + T, by1 - T, 0, h), box(W - T, W, fy0 + T, by1 - T, 0, h)] });
  }
  if (spec.baseType === 'steel_frame') {
    const profile = L.steelProfile(spec.steel.profileId);
    const sec = parseFloat(profile.sectionSpec) || 25.4;
    steel.push({
      id: `${spec.id}-STEEL-BASE`, moduleId: spec.id, profileId: profile.id, shape: profile.shape, sectionSpec: profile.sectionSpec, finish: spec.steel.finish, loadValidationRequired: true,
      pieces: [
        { id: `${spec.id}-ST-LEG`, label: 'Pata', lengthMm: r2(h), count: 4 },
        { id: `${spec.id}-ST-RAIL-W`, label: 'Larguero frontal/trasero', lengthMm: r2(W - 2 * sec), count: 2 },
        { id: `${spec.id}-ST-RAIL-D`, label: 'Travesaño lateral', lengthMm: r2(cd - 2 * sec), count: 2 },
      ],
    });
    b.issue({ code: 'STEEL_LOAD_VALIDATION_REQUIRED', severity: 'blocker', message: `Bastidor de ${profile.name}: requiere validación de cargas, soldadura y anclaje por responsable estructural.` });
  }
}

function mountingHardware(ctx: Ctx) {
  const { spec, L, b, family } = ctx;
  const W = spec.widthMm;
  if (spec.mount === 'wall') {
    const hanger = L.hardware('cabinet-hanger');
    const n = W > 900 ? 4 : 2;
    b.hw({ category: 'wall_anchor', productId: hanger.id, productKey: hanger.productKey, description: hanger.name, quantity: n, unit: hanger.unit, basis: `${n} colgadores por ancho ${W} mm (orientativo)`, validationStatus: 'pending_validation' });
    b.issue({ code: 'WALL_MOUNT_VALIDATION', severity: 'blocker', message: 'Módulo colgado a muro: validar carga, tipo de muro, taquetes y colgadores con ficha técnica antes de liberar.' });
    return;
  }
  const tall = spec.heightMm + (spec.baseType === 'none' ? 0 : spec.baseHeightMm) >= ENGINE_DEFAULTS.tallUnitAntiTipMm;
  const drawerUnit = spec.front === 'drawers' && spec.heightMm >= ENGINE_DEFAULTS.drawerUnitAntiTipMm;
  if (tall || drawerUnit || family.geometryStrategy === 'wardrobe') {
    const a = L.hardware('wall-anchor-antitip');
    const n = W > 900 ? 2 : 1;
    b.hw({ category: 'wall_anchor', productId: a.id, productKey: a.productKey, description: a.name, quantity: n, unit: a.unit, basis: tall ? 'mueble alto' : 'mueble con cajones (riesgo de vuelco)', validationStatus: 'pending_validation' });
    b.issue({ code: 'ANTITIP_REQUIRED', severity: 'blocker', message: 'Riesgo de vuelco: instalar anclaje antivuelco a muro validado según tipo de muro.' });
  }
}

// ---------------------------------------------------------------------------
// Escritorio
// ---------------------------------------------------------------------------

function buildDesk(ctx: Ctx): Partial<ModuleResult> {
  const { spec, L, b, material } = ctx;
  const { widthMm: W, heightMm: H, depthMm: D, thicknessMm: T } = spec;
  const all: EdgeName[] = spec.edgePolicy === 'none' ? [] : ['L1', 'L2', 'A1', 'A2'];
  if (spec.front !== 'open') b.issue({ code: 'DESK_FRONT_IGNORED', severity: 'info', message: 'Escritorio: frentes de puerta/cajón no se modelan en esta versión (use un módulo de cajonera aparte).' });
  b.part({ code: 'DESK_TOP', name: 'Cubierta de escritorio', role: 'desk', lengthMm: W, widthMm: D, thicknessMm: T, grainAxis: 'length', edges: all, materialId: material.id,
    placements: [box(0, W, 0, D, H - T, H)] });
  const steel: SteelRequirement[] = [];
  const legH = H - T;
  if (legH < ENGINE_DEFAULTS.deskMinKneeClearanceMm) b.issue({ code: 'DESK_KNEE_CLEARANCE', severity: 'warning', message: `Altura libre bajo cubierta ${r2(legH)} mm < ${ENGINE_DEFAULTS.deskMinKneeClearanceMm} mm recomendados.` });

  if (spec.steel.enabled) {
    const profile = L.steelProfile(spec.steel.profileId);
    const sec = parseFloat(profile.sectionSpec) || 25.4;
    steel.push({
      id: `${spec.id}-STEEL-DESK`, moduleId: spec.id, profileId: profile.id, shape: profile.shape, sectionSpec: profile.sectionSpec, finish: spec.steel.finish, loadValidationRequired: true,
      pieces: [
        { id: `${spec.id}-ST-LEG`, label: 'Pata', lengthMm: r2(legH), count: 4 },
        { id: `${spec.id}-ST-RAIL-W`, label: 'Larguero bajo cubierta', lengthMm: r2(W - 100 - 2 * sec), count: 2 },
        { id: `${spec.id}-ST-RAIL-D`, label: 'Travesaño lateral', lengthMm: r2(D - 100 - 2 * sec), count: 2 },
      ],
    });
    b.issue({ code: 'STEEL_LOAD_VALIDATION_REQUIRED', severity: 'blocker', message: `Bastidor de ${profile.name}: validar cargas, rigidez lateral, soldadura y nivelación con responsable estructural.` });
    const screw = L.hardware('screw-4x40');
    b.hw({ category: 'screw', productId: screw.id, productKey: screw.productKey, description: `${screw.name} — fijación cubierta a bastidor`, quantity: 8, unit: screw.unit, basis: '8 puntos orientativos', validationStatus: 'pending_validation' });
  } else {
    const sideEdges: EdgeName[] = spec.edgePolicy === 'none' ? [] : spec.edgePolicy === 'all_visible' ? ['L1', 'L2', 'A1'] : ['L1'];
    b.part({ code: 'DESK_SIDE', name: 'Costado tipo panel (pata)', role: 'desk', lengthMm: legH, widthMm: D, thicknessMm: T, grainAxis: 'length', edges: sideEdges, materialId: material.id,
      placements: [box(0, T, 0, D, 0, legH), box(W - T, W, 0, D, 0, legH)] });
    const mh = Math.min(ENGINE_DEFAULTS.deskMaxModestyMm, legH - 120);
    const span = W - 2 * T;
    if (span < ENGINE_DEFAULTS.deskMinLegroomWidthMm) b.issue({ code: 'DESK_LEGROOM_WIDTH', severity: 'warning', message: `Ancho libre entre costados ${r2(span)} mm < ${ENGINE_DEFAULTS.deskMinLegroomWidthMm} mm.` });
    let joints = 2;
    if (mh > 60) {
      b.part({ code: 'DESK_MODESTY', name: 'Faldón posterior', role: 'desk', lengthMm: span, widthMm: mh, thicknessMm: T, grainAxis: 'length', edges: spec.edgePolicy === 'none' ? [] : ['L1'], materialId: material.id,
        placements: [box(T, W - T, D - 20 - T, D - 20, legH - mh, legH)], notes: ['Remetido 20 mm del fondo; rigidiza los costados.'] });
      joints += 2;
    } else {
      b.issue({ code: 'DESK_NO_MODESTY', severity: 'warning', message: 'Sin faldón: rigidez lateral insuficiente; agregar larguero o escuadras.' });
    }
    joineryHardware(ctx, joints, D, [{ partId: `${spec.id}-DESK_SIDE`, joints }]);
  }
  const span = W - 2 * T;
  const maxSpan = (material.maxShelfSpanMm ?? 800) * 1.5;
  if (span > maxSpan) b.issue({ code: 'DESK_TOP_SPAN', severity: 'warning', message: `Claro de cubierta ${r2(span)} mm: verificar flecha con la carga prevista; agregar larguero o apoyo intermedio.` });
  b.issue({ code: 'DESK_RIGIDITY_REVIEW', severity: 'info', message: 'Verificar rigidez y flecha de la cubierta para la carga prevista.' });
  return { theoreticalDiagonalMm: r2(Math.hypot(W, H)), carcassDepthMm: D, overallHeightMm: H, steel };
}

// ---------------------------------------------------------------------------
// Validaciones geométricas
// ---------------------------------------------------------------------------

function checkSheetFit(ctx: Ctx) {
  const { L, b, spec } = ctx;
  const finish = L.finish(spec.finishId);
  for (const p of b.parts) {
    const m = L.material(p.materialId);
    if (!m.sheet) continue;
    const { lengthMm: SL, widthMm: SW } = m.sheet;
    const canRotate = p.grainAxis === 'none' || !finish.hasGrain;
    const fits = (p.lengthMm <= SL && p.widthMm <= SW) || (canRotate && p.lengthMm <= SW && p.widthMm <= SL);
    if (!fits) b.issue({ code: 'PART_EXCEEDS_SHEET', severity: 'error', partId: p.id, message: `${p.id} (${p.lengthMm} × ${p.widthMm} mm) no cabe en el tablero ${SL} × ${SW} mm${canRotate ? '' : ' respetando la veta'}. Dividir en módulos o usar formato mayor.` });
  }
}

function checkCollisions(b: ModuleBuilder) {
  const all = b.parts.flatMap((p) => p.placements.map((pl, i) => ({ id: `${p.id}#${i + 1}`, partId: p.id, pl })));
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const v = overlapVolume(all[i]!.pl, all[j]!.pl);
      if (v > 0) b.issue({ code: 'COLLISION', severity: 'error', partId: all[i]!.partId, message: `Interferencia geométrica entre ${all[i]!.id} y ${all[j]!.id} (${r2(v / 1000)} cm³).` });
    }
  }
}
