import { catalogLookup, type Catalog } from '../catalog';
import type { MaterialNesting, SteelNesting } from '../engine/nesting';
import {
  CALC_VERSION,
  type Cents, type PricingMode, type Project, type ProjectCalculation, type Quote, type QuoteLine, type QuoteLineCategory, type SupplierOffer,
} from '../types';

export interface Requirement {
  key: string;
  category: QuoteLineCategory;
  description: string;
  quantity: number;
  unit: string;
  required: boolean;
  notes: string[];
}

/** Precio de venta antes de IVA. Margen sobre venta ≠ markup sobre costo. */
export function sellPriceCents(costCents: Cents, mode: PricingMode, pct: number): Cents {
  if (mode === 'margin') {
    if (pct >= 100 || pct < 0) throw new RangeError('El margen sobre venta debe estar en [0, 100).');
    return Math.round(costCents / (1 - pct / 100));
  }
  if (pct < 0) throw new RangeError('El markup no puede ser negativo.');
  return Math.round(costCents * (1 + pct / 100));
}

/** Precio neto (sin IVA) de una presentación. null si el IVA no está definido. */
export function netPackCents(o: Pick<SupplierOffer, 'priceCents' | 'taxIncluded' | 'taxRatePct'>): Cents | null {
  if (o.priceCents === null || o.taxIncluded === null) return null;
  if (!o.taxIncluded) return o.priceCents;
  if (o.taxRatePct === null) return null;
  return Math.round(o.priceCents / (1 + o.taxRatePct / 100));
}

export function isExpired(o: SupplierOffer, today: string): boolean {
  return o.priceStatus === 'VENCIDO' || (o.validUntil !== null && o.validUntil < today);
}

export interface OfferEvaluation {
  offer: SupplierOffer;
  usable: boolean;
  reason: string | null;
  netPackCents: Cents | null;
  purchaseQuantity: number;
  landedNetCents: Cents | null;
  /** Costo neto por unidad de requerimiento, para comparar presentaciones distintas. */
  netPerRequiredUnitCents: number | null;
}

export function evaluateOffers(req: Pick<Requirement, 'key' | 'quantity'>, offers: SupplierOffer[], today: string, allowEstimated: boolean): OfferEvaluation[] {
  return offers.filter((o) => o.productKey === req.key).map((o) => {
    const net = netPackCents(o);
    const purchaseQuantity = Math.ceil(req.quantity / o.packQuantity - 1e-9);
    let reason: string | null = null;
    if (o.priceStatus === 'PENDIENTE' || o.priceCents === null) reason = 'Precio pendiente de cotizar';
    else if (isExpired(o, today)) reason = 'Oferta vencida: no se usa automáticamente';
    else if (net === null) reason = 'IVA no definido (incluido/excluido y tasa)';
    else if (o.priceStatus === 'ESTIMADO' && !allowEstimated) reason = 'Precio estimado: sólo para simulación';
    else if (o.available === false) reason = 'Sin disponibilidad reportada';
    return {
      offer: o, usable: reason === null, reason, netPackCents: net, purchaseQuantity,
      landedNetCents: net === null ? null : net * purchaseQuantity,
      netPerRequiredUnitCents: net === null ? null : Math.round((net / o.packQuantity) * 100) / 100,
    };
  }).sort((a, b) => (a.landedNetCents ?? Infinity) - (b.landedNetCents ?? Infinity) || a.offer.id.localeCompare(b.offer.id));
}

export function buildRequirements(project: Project, calc: ProjectCalculation, nesting: MaterialNesting[], steel: SteelNesting[], catalog: Catalog): Requirement[] {
  const L = catalogLookup(catalog);
  const reqs: Requirement[] = [];
  for (const n of nesting) {
    if (n.layout === null) {
      reqs.push({ key: n.productKey, category: 'board', description: `${n.materialName} (madera maciza)`, quantity: Math.round(n.areaEstimate.pieceAreaM2 * 1.3 * 100) / 100, unit: 'm²', required: true, notes: [n.note, 'Cantidad: área de piezas + 30 % (estimación no validada).'] });
      continue;
    }
    reqs.push({
      key: n.productKey, category: 'board', description: `${n.materialName} ${n.layout.sheet.lengthMm}×${n.layout.sheet.widthMm}`,
      quantity: n.sheetsRequired ?? n.areaEstimate.sheetsEstimated, unit: 'hoja', required: true,
      notes: n.sheetsRequired === null ? ['estimacion_area_no_validada: hay piezas sin acomodo'] : [`layout_factible: ${n.sheetsRequired} tablero(s)`],
    });
  }
  for (const e of calc.edgeBands) {
    reqs.push({ key: e.productKey, category: 'edge', description: L.edgeBand(e.edgeBandId).name, quantity: Math.round(e.purchaseLengthMm / 10) / 100, unit: 'm', required: true, notes: [`Neto ${Math.round(e.netLengthMm) / 1000} m en ${e.segments} tramos + margen ${project.pricing.edgeAllowancePerSegmentMm} mm/tramo + merma ${project.pricing.edgeWastePct} %`] });
  }
  const hw = new Map<string, Requirement>();
  for (const h of calc.hardware) {
    const cur = hw.get(h.productKey);
    if (cur) cur.quantity = Math.round((cur.quantity + h.quantity) * 100) / 100;
    else hw.set(h.productKey, { key: h.productKey, category: 'hardware', description: h.description, quantity: h.quantity, unit: h.unit, required: true, notes: h.validationStatus === 'verified' ? [] : ['Herraje pendiente de validación con ficha'] });
  }
  reqs.push(...[...hw.values()].sort((a, b) => a.key.localeCompare(b.key)));
  for (const s of steel) {
    const bars = s.layout.bars.length;
    reqs.push({ key: s.productKey, category: 'steel', description: `${s.profileName} (barras de ${s.layout.barLengthMm / 1000} m)`, quantity: Math.round(bars * s.layout.barLengthMm) / 1000, unit: 'm', required: true, notes: [`${bars} barra(s) por acomodo FFD; corte total ${Math.round(s.layout.totalCutLengthMm) / 1000} m`, s.massKg === null ? 'Masa no calculada: sin kg/m de ficha' : `Masa ${s.massKg} kg`] });
  }
  return reqs;
}

export function buildQuote(
  project: Project, calc: ProjectCalculation, nesting: MaterialNesting[], steel: SteelNesting[], catalog: Catalog,
  offers: SupplierOffer[], today: string, generatedAt: string,
): Quote {
  const p = project.pricing;
  const reqs = buildRequirements(project, calc, nesting, steel, catalog);
  const lines: QuoteLine[] = [];
  const warnings: string[] = [];

  for (const r of reqs) {
    const evals = evaluateOffers(r, offers, today, p.allowEstimatedPrices);
    const selectedId = p.selectedOffers[r.key];
    const explicit = selectedId ? evals.find((e) => e.offer.id === selectedId) : undefined;
    if (selectedId && !explicit) warnings.push(`Oferta seleccionada ${selectedId} no existe para ${r.key}; se usa selección automática.`);
    const chosen = explicit ?? evals.find((e) => e.usable);
    const line: QuoteLine = {
      key: r.key, category: r.category, description: r.description, requiredQuantity: r.quantity, requiredUnit: r.unit,
      purchaseQuantity: null, purchaseUnit: null, offerId: null, supplierId: null, sku: null, unitNetCents: null, lineNetCents: null,
      priceStatus: null, verifiedAt: null, sourceUrl: null, status: 'PENDING', required: r.required, notes: [...r.notes], alternatives: evals.length,
    };
    if (chosen) {
      const o = chosen.offer;
      Object.assign(line, {
        offerId: o.id, supplierId: o.supplierId, sku: o.sku, purchaseQuantity: chosen.purchaseQuantity, purchaseUnit: o.purchaseUnit,
        priceStatus: o.priceStatus, verifiedAt: o.verifiedAt, sourceUrl: o.sourceUrl,
      });
      if (o.priceCents === null || o.priceStatus === 'PENDIENTE') {
        line.status = 'PENDING';
        line.notes.push('Oferta sin precio: cotización pendiente.');
      } else if (chosen.netPackCents === null) {
        line.status = 'TAX_UNKNOWN';
        line.notes.push('No se puede usar: IVA no definido.');
      } else {
        line.unitNetCents = chosen.netPackCents;
        line.lineNetCents = chosen.landedNetCents;
        line.status = isExpired(o, today) ? 'EXPIRED_SELECTED' : o.priceStatus === 'ESTIMADO' ? 'ESTIMATED' : 'PRICED';
        if (line.status === 'EXPIRED_SELECTED') line.notes.push('Oferta vencida seleccionada manualmente: actualizar cotización.');
        if (line.status === 'ESTIMATED') line.notes.push('Precio ESTIMADO: sólo simulación.');
      }
    } else {
      line.notes.push(evals.length ? `Ninguna de ${evals.length} oferta(s) es utilizable: ${[...new Set(evals.map((e) => e.reason))].join('; ')}` : 'Sin ofertas registradas para esta clave.');
    }
    lines.push(line);
  }

  const hasSteel = steel.length > 0;
  for (const m of p.manualCosts) {
    const required = m.applies || (m.key === 'service:steel_fabrication' && hasSteel);
    const line: QuoteLine = {
      key: m.key, category: 'service', description: m.label, requiredQuantity: 1, requiredUnit: 'servicio', purchaseQuantity: required ? 1 : null, purchaseUnit: 'servicio',
      offerId: null, supplierId: null, sku: null, unitNetCents: null, lineNetCents: null, priceStatus: null, verifiedAt: null, sourceUrl: null,
      status: 'NOT_APPLICABLE', required, notes: m.notes ? [m.notes] : [], alternatives: 0,
    };
    if (required) {
      if (m.amountCents === null) {
        line.status = 'PENDING';
        line.notes.push('Monto pendiente de captura (no se asume $0).');
        if (!m.applies) line.notes.push('Requerido porque el proyecto incluye herrería.');
      } else {
        const net = m.taxIncluded ? Math.round(m.amountCents / (1 + p.taxRatePct / 100)) : m.amountCents;
        Object.assign(line, { unitNetCents: net, lineNetCents: net, status: 'PRICED', priceStatus: 'CAPTURADO_MANUAL' });
      }
    }
    lines.push(line);
  }

  const missing = lines.filter((l) => l.required && (l.status === 'PENDING' || l.status === 'TAX_UNKNOWN' || l.status === 'EXPIRED_SELECTED'));
  const direct = lines.reduce((s, l) => s + (l.lineNetCents ?? 0), 0);
  const pct = p.mode === 'margin' ? p.marginPct : p.markupPct;
  const pricedLines = lines.filter((l) => l.lineNetCents !== null).length;
  let sell: Cents | null = null;
  // Sin ninguna línea con precio no hay importe que mostrar: nunca se presenta $0.
  if (pricedLines > 0) {
    try { sell = sellPriceCents(direct, p.mode, pct); } catch (e) { warnings.push((e as Error).message); }
  }
  const tax = sell === null ? null : Math.round((sell * p.taxRatePct) / 100);
  const boardMethod = nesting.every((n) => n.sheetsRequired !== null) ? 'layout_factible' as const : 'estimacion_area_no_validada' as const;
  if (boardMethod !== 'layout_factible') warnings.push('Cantidad de tableros por estimación de área no validada.');
  if (calc.hardware.some((h) => h.validationStatus !== 'verified')) warnings.push('Cantidades de herrajes orientativas: pendientes de validar con fichas técnicas.');

  return {
    calcVersion: CALC_VERSION, projectId: project.id, generatedAt, currency: 'MXN', lines,
    directCostNetCents: pricedLines > 0 ? direct : null, mode: p.mode, marginPct: p.marginPct, markupPct: p.markupPct,
    sellBeforeTaxCents: sell, taxRatePct: p.taxRatePct, taxCents: tax, totalCents: sell === null || tax === null ? null : sell + tax,
    completeness: missing.length ? 'INCOMPLETO' : lines.some((l) => l.status === 'ESTIMATED') ? 'SIMULACION' : 'COMPLETO',
    missingLines: missing.map((l) => l.key),
    warnings,
    boardMethod,
  };
}

export const formatMXN = (cents: Cents | null): string =>
  cents === null ? 'Pendiente' : new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cents / 100);
