import { describe, expect, it } from 'vitest';
import fixtures from '../../data/seed/fixtures.json';
import legacy from '../../data/seed/proyecto_ejemplo.json';
import { estimateSheetsByArea, optimizeBars, optimizeSheets } from '@ms/cut-optimizer';
import {
  DEFAULT_CATALOG, DEMO_OFFERS, calculateProject, createModule, createProject, evaluateOffers, importOffersCsv, migrateProject, nestParts,
  netPackCents, parseCsv, parseMoneyToCents, parseProject, planProject, sellPriceCents, type Project, type SupplierOffer,
} from '@ms/domain';

const cat = DEFAULT_CATALOG;
const NOW = '2026-01-01T00:00:00.000Z';
const TODAY = '2026-01-01';

function baseProject(): Project {
  return createProject({ id: 'p1', name: 'Prueba', familyId: 'kitchen_base', now: NOW }, cat);
}

const offer = (o: Partial<SupplierOffer>): SupplierOffer => ({
  id: 'o1', supplierId: 'tym_forest', productKey: 'board:mel18', sku: 'X', description: 'x', packQuantity: 1, purchaseUnit: 'hoja', currency: 'MXN',
  priceCents: 100000, taxIncluded: false, taxRatePct: 16, priceStatus: 'COTIZADO', verifiedAt: '2025-12-01', validUntil: null, sourceUrl: null,
  quoteReference: 'F-1', available: true, reliability: 'alta', capturedBy: 'test', notes: '', ...o,
});

describe('precio de venta', () => {
  it('margen 25 % sobre costo $1000 => $1333.33 (no $1250)', () => {
    const c = fixtures.pricingCases[0]!;
    const cents = sellPriceCents(c.costBeforeTaxMxn! * 100, 'margin', c.marginPct!);
    expect(cents / 100).toBe(c.expectedSellBeforeTaxMxn);
    expect(cents).not.toBe(125000);
  });
  it('markup 25 % => $1250', () => {
    expect(sellPriceCents(100000, 'markup', 25)).toBe(125000);
  });
  it('margen >= 100 % es inválido', () => {
    expect(() => sellPriceCents(100000, 'margin', 100)).toThrow();
  });
});

describe('normalización de IVA', () => {
  it('con IVA incluido se desglosa; sin IVA se respeta; desconocido no se usa', () => {
    expect(netPackCents({ priceCents: 116000, taxIncluded: true, taxRatePct: 16 })).toBe(100000);
    expect(netPackCents({ priceCents: 100000, taxIncluded: false, taxRatePct: 16 })).toBe(100000);
    expect(netPackCents({ priceCents: 100000, taxIncluded: null, taxRatePct: null })).toBeNull();
  });
  it('compara ofertas con/sin IVA y presentaciones distintas', () => {
    const evals = evaluateOffers({ key: 'board:mel18', quantity: 3 }, [
      offer({ id: 'a', priceCents: 116000, taxIncluded: true }),
      offer({ id: 'b', priceCents: 99000, taxIncluded: false }),
      offer({ id: 'c', priceCents: null, priceStatus: 'PENDIENTE' }),
      offer({ id: 'd', priceCents: 50000, validUntil: '2025-06-01' }),
    ], TODAY, false);
    expect(evals[0]!.offer.id).toBe('d'); // más barata pero vencida => no utilizable
    expect(evals[0]!.usable).toBe(false);
    expect(evals.find((e) => e.usable)!.offer.id).toBe('b');
    expect(evals.find((e) => e.offer.id === 'a')!.landedNetCents).toBe(300000);
    expect(evals.find((e) => e.offer.id === 'c')!.reason).toMatch(/pendiente/i);
  });
});

describe('cotización', () => {
  it('falta un precio obligatorio => INCOMPLETO y nunca $0 por la línea', () => {
    const plan = planProject(baseProject(), cat, [], TODAY, NOW);
    expect(plan.quote.completeness).toBe(fixtures.pricingCases[1]!.expectedStatus === 'INCOMPLETE' ? 'INCOMPLETO' : 'COMPLETO');
    const board = plan.quote.lines.find((l) => l.key === 'board:mel18')!;
    expect(board.status).toBe('PENDING');
    expect(board.lineNetCents).toBeNull();
    expect(plan.quote.missingLines).toContain('board:mel18');
    // Sin ninguna línea con precio no se presenta importe alguno (nunca $0).
    expect(plan.quote.directCostNetCents).toBeNull();
    expect(plan.quote.totalCents).toBeNull();
  });

  it('cambiar precio de oferta recalcula costo y venta', () => {
    const p = baseProject();
    p.pricing.manualCosts = [];
    const keys = new Set(planProject(p, cat, [], TODAY, NOW).quote.lines.map((l) => l.key));
    const offers = [...keys].map((k, i) => offer({ id: `o${i}`, productKey: k, priceCents: 1000 }));
    const q1 = planProject(p, cat, offers, TODAY, NOW).quote;
    expect(q1.completeness).toBe('COMPLETO');
    const offers2 = offers.map((o) => (o.productKey === 'board:mel18' ? { ...o, priceCents: 51000 } : o));
    const q2 = planProject(p, cat, offers2, TODAY, NOW).quote;
    const sheets = q2.lines.find((l) => l.key === 'board:mel18')!.purchaseQuantity!;
    expect(q2.directCostNetCents! - q1.directCostNetCents!).toBe(sheets * 50000);
    expect(q2.sellBeforeTaxCents).toBe(Math.round(q2.directCostNetCents! / 0.75));
    expect(q2.taxCents).toBe(Math.round(q2.sellBeforeTaxCents! * 0.16));
  });

  it('precio ESTIMADO sólo con permiso explícito y marca SIMULACION', () => {
    const p = baseProject();
    p.modules[0]!.hingeProductId = 'hinge-samet-master110';
    const q = planProject(p, cat, DEMO_OFFERS, TODAY, NOW).quote;
    expect(q.lines.find((l) => l.key === 'hw:samet:SAM1010041150')!.status).toBe('PENDING');
    p.pricing.selectedOffers['hw:samet:SAM1010041150'] = 'demo-tym-hinge-master';
    const q2 = planProject(p, cat, DEMO_OFFERS, TODAY, NOW).quote;
    const line = q2.lines.find((l) => l.key === 'hw:samet:SAM1010041150')!;
    expect(line.status).toBe('ESTIMATED');
    expect(line.purchaseQuantity).toBe(2); // 4 bisagras / bolsa de 2
    expect(line.unitNetCents).toBe(Math.round(5700 / 1.16));
  });

  it('los montos manuales nulos quedan pendientes', () => {
    const q = planProject(baseProject(), cat, [], TODAY, NOW).quote;
    const labor = q.lines.find((l) => l.key === 'service:labor')!;
    expect(labor.status).toBe('PENDING');
    expect(q.lines.find((l) => l.key === 'service:steel_fabrication')!.status).toBe('NOT_APPLICABLE');
  });
});

describe('optimizador de corte', () => {
  it('nesting factible no se rotula como estimación de área y no traslapa', () => {
    const calc = calculateProject({ ...baseProject(), modules: [createModule('wardrobe', cat, 'M01')] }, cat);
    const nest = nestParts(calc.parts, cat, { kerfMm: 4, trimMarginMm: 10 });
    for (const n of nest) {
      expect(n.areaEstimate.status).toBe('estimacion_area_no_validada');
      expect(n.layout!.status).toBe('layout_factible');
      for (const s of n.layout!.sheets) {
        for (const a of s.placements) {
          expect(a.x).toBeGreaterThanOrEqual(10);
          expect(a.x + a.w).toBeLessThanOrEqual(2440 - 10 + 1e-6);
          expect(a.y + a.h).toBeLessThanOrEqual(1220 - 10 + 1e-6);
          for (const b of s.placements) {
            if (a === b) continue;
            const sep = a.x + a.w + 4 <= b.x + 1e-6 || b.x + b.w + 4 <= a.x + 1e-6 || a.y + a.h + 4 <= b.y + 1e-6 || b.y + b.h + 4 <= a.y + 1e-6;
            expect(sep).toBe(true);
          }
        }
      }
      const placed = n.layout!.sheets.reduce((s, x) => s + x.placements.length, 0);
      expect(placed).toBe(calc.parts.filter((p) => p.materialId === n.materialId).reduce((s, p) => s + p.quantity, 0));
    }
  });

  it('respeta veta: sin rotación una pieza larga no cabe atravesada', () => {
    const r = optimizeSheets([{ partId: 'A', label: 'A', lengthMm: 1210, widthMm: 2400, quantity: 1, canRotate: false }], { lengthMm: 2440, widthMm: 1220, kerfMm: 4, trimMarginMm: 5 });
    expect(r.status).toBe('layout_incompleto');
    const r2 = optimizeSheets([{ partId: 'A', label: 'A', lengthMm: 1210, widthMm: 2400, quantity: 1, canRotate: true }], { lengthMm: 2440, widthMm: 1220, kerfMm: 4, trimMarginMm: 5 });
    expect(r2.status).toBe('layout_factible');
    expect(r2.sheets[0]!.placements[0]!.rotated).toBe(true);
  });

  it('estimación por área siempre rotulada no validada', () => {
    expect(estimateSheetsByArea([{ partId: 'A', label: 'A', lengthMm: 1000, widthMm: 500, quantity: 4, canRotate: true }], { lengthMm: 2440, widthMm: 1220, kerfMm: 4, trimMarginMm: 10 }).status).toBe('estimacion_area_no_validada');
  });

  it('barras 1D con kerf', () => {
    const r = optimizeBars([{ id: 'L', label: 'Pata', lengthMm: 3000, count: 3 }], 6100, 3);
    expect(r.bars.length).toBe(2);
    expect(r.bars[0]!.remainderMm).toBe(6100 - 6003);
  });
});

describe('importación CSV de ofertas', () => {
  const header = 'supplierId;productKey;sku;description;packQuantity;purchaseUnit;price;taxIncluded;taxRatePct;priceStatus;verifiedAt;validUntil;sourceUrl;quoteReference;available;reliability;capturedBy;notes';
  it('valida, convierte importes es-MX y de-duplica', () => {
    const csv = `\uFEFF${header}\n` +
      'pajaro_carpintero;board:mel18;MEL-18-BL;"Melamina blanca; 18 mm";1;hoja;"1.234,50";si;16;COTIZADO;2026-01-02;2026-02-01;;F-77;si;alta;Víctor;\n' +
      'pajaro_carpintero;board:mel18;MEL-18-BL;"Melamina blanca; 18 mm";1;hoja;"1.234,50";si;16;COTIZADO;2026-01-02;2026-02-01;;F-77;si;alta;Víctor;\n' +
      'tym_forest;hw:x;S1;Algo;2;bolsa;;;;PENDIENTE;;;;;;baja;;\n' +
      'tym_forest;hw:x;S2;Algo;2;bolsa;100;si;16;PUBLICADO_VERIFICADO;;;;;;baja;;\n' +
      'desconocido;hw:x;S3;Algo;2;bolsa;100;si;16;COTIZADO;;;;F;;baja;;\n';
    const r = importOffersCsv(csv, [], 'imp', ['pajaro_carpintero', 'tym_forest']);
    expect(r.offers.length).toBe(2);
    expect(r.offers[0]!.priceCents).toBe(123450);
    expect(r.offers[0]!.description).toBe('Melamina blanca; 18 mm');
    expect(r.offers[1]!.priceCents).toBeNull();
    expect(r.duplicates).toBe(1);
    expect(r.errors.map((e) => e.row)).toEqual([5, 6]);
  });
  it('parser CSV y montos', () => {
    expect(parseCsv('a,b\n"x, y","z""w"\n')).toEqual([['a', 'b'], ['x, y', 'z"w']]);
    expect(parseMoneyToCents('$1,234.50')).toBe(123450);
    expect(parseMoneyToCents('')).toBeNull();
  });
});

describe('esquema y migración', () => {
  it('proyecto guardado se reabre sin cambios de geometría', () => {
    const p = baseProject();
    const reopened = parseProject(JSON.parse(JSON.stringify(p)));
    expect(calculateProject(reopened, cat)).toEqual(calculateProject(p, cat));
  });
  it('migra el ejemplo del paquete (assemblies) explícitamente', () => {
    const { project, migrated, notes } = migrateProject(legacy, cat, NOW);
    expect(migrated).toBe(true);
    expect(notes[0]).toMatch(/Migrado/);
    const calc = calculateProject(project, cat);
    expect(calc.parts.find((x) => x.code === 'SIDE')!.lengthMm).toBe(850);
    expect(calc.parts.find((x) => x.code === 'HORIZONTAL')!.lengthMm).toBe(764);
    expect(calc.parts.find((x) => x.code === 'BACK')).toBeUndefined();
  });
  it('rechaza margen >= 100 y medidas no positivas', () => {
    const p = baseProject();
    expect(() => parseProject({ ...p, pricing: { ...p.pricing, marginPct: 100 } })).toThrow();
    expect(() => parseProject({ ...p, modules: [{ ...p.modules[0]!, widthMm: -1 }] })).toThrow();
  });
});
