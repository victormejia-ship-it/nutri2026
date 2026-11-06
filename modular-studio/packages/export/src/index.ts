/**
 * Exportaciones: JSON versionado, CSV (UTF-8 con BOM, compatible con Excel es-MX), SVG, Mermaid y PDF.
 * Todas consumen el mismo plan congelado (ManufacturingPlan) para no divergir.
 * DXF/DWG: NO implementados (no se prometen).
 */
import {
  CALC_VERSION, FAMILIES, QC_CHECKLIST, assemblySteps, catalogLookup, formatMXN, mermaidDiagram,
  type Catalog, type ManufacturingPlan, type Project,
} from '@ms/domain';
import { buildScene, cutSheetSvg, sceneToSvg, type SceneOptions } from '@ms/geometry';

export { buildPdf } from './pdf';

export type CsvSeparator = ',' | ';';

export function toCsv(rows: (string | number | null | undefined)[][], sep: CsvSeparator = ','): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",;\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(cell).join(sep)).join('\r\n') + '\r\n';
}

/** Número con separador decimal acorde al separador de campos (';' => coma decimal para Excel es-MX). */
const num = (n: number, sep: CsvSeparator) => (sep === ';' ? String(n).replace('.', ',') : String(n));

export function partsCsv(plan: ManufacturingPlan, catalog: Catalog, sep: CsvSeparator = ','): string {
  const L = catalogLookup(catalog);
  const head = ['ID', 'Módulo', 'Pieza', 'Rol', 'Cantidad', 'Largo (mm)', 'Ancho (mm)', 'Espesor (mm)', 'Veta', 'Canto L1', 'Canto L2', 'Canto A1', 'Canto A2', 'Material', 'SKU material', 'Acabado', 'Área (m²)', 'Estado validación', 'Mecanizados', 'Observaciones'];
  const rows = plan.calc.parts.map((p) => {
    const m = L.material(p.materialId);
    return [
      p.id, p.moduleId, p.name, p.role, p.quantity, num(p.lengthMm, sep), num(p.widthMm, sep), num(p.thicknessMm, sep), p.grainAxis,
      p.edgeBand.L1 ?? '', p.edgeBand.L2 ?? '', p.edgeBand.A1 ?? '', p.edgeBand.A2 ?? '', m.name, m.productKey, L.finish(p.finishId).name,
      num(Math.round((p.lengthMm * p.widthMm * p.quantity) / 1e4) / 100, sep), p.validationStatus, p.machiningOperationIds.length, p.notes.join(' | '),
    ];
  });
  return toCsv([head, ...rows], sep);
}

export function quoteCsv(plan: ManufacturingPlan, sep: CsvSeparator = ','): string {
  const q = plan.quote;
  const money = (c: number | null) => (c === null ? 'PENDIENTE' : num(c / 100, sep));
  const head = ['Clave', 'Categoría', 'Descripción', 'Cant. requerida', 'Unidad', 'Cant. compra', 'Presentación', 'Proveedor', 'SKU', 'Precio neto unitario (MXN, sin IVA)', 'Importe neto (MXN, sin IVA)', 'Estado precio', 'Estado línea', 'Fecha verificación', 'Fuente', 'Notas'];
  const rows = q.lines.filter((l) => l.status !== 'NOT_APPLICABLE').map((l) => [
    l.key, l.category, l.description, num(l.requiredQuantity, sep), l.requiredUnit, l.purchaseQuantity ?? '', l.purchaseUnit ?? '', l.supplierId ?? '', l.sku ?? '',
    money(l.unitNetCents), money(l.lineNetCents), l.priceStatus ?? 'PENDIENTE', l.status, l.verifiedAt ?? '', l.sourceUrl ?? '', l.notes.join(' | '),
  ]);
  const tail = [
    [],
    ['Costo directo neto (sin IVA)', money(q.directCostNetCents)],
    [q.mode === 'margin' ? `Precio de venta (margen ${q.marginPct} % sobre venta)` : `Precio de venta (markup ${q.markupPct} % sobre costo)`, money(q.sellBeforeTaxCents)],
    [`IVA ${q.taxRatePct} %`, money(q.taxCents)],
    ['Total', money(q.totalCents)],
    ['Estado de la cotización', q.completeness],
    ['Líneas faltantes', q.missingLines.join(' ')],
    ['Método de tableros', q.boardMethod],
    ['Versión de cálculo', q.calcVersion],
  ];
  return toCsv([head, ...rows, ...tail], sep);
}

export function hardwareCsv(plan: ManufacturingPlan, sep: CsvSeparator = ','): string {
  const head = ['ID', 'Módulo', 'Categoría', 'Descripción', 'Clave producto', 'Cantidad', 'Unidad', 'Regla aplicada', 'Estado validación'];
  const rows = plan.calc.hardware.map((h) => [h.id, h.moduleId, h.category, h.description, h.productKey, num(h.quantity, sep), h.unit, h.basis, h.validationStatus]);
  const steel = plan.calc.steel.flatMap((s) => s.pieces.map((p) => [p.id, s.moduleId, `herrería ${s.shape}`, `${p.label} ${s.sectionSpec}`, s.profileId, p.count, `pza de ${p.lengthMm} mm`, 'geometría', s.loadValidationRequired ? 'requiere validación de cargas' : '']));
  return toCsv([head, ...rows, ...steel], sep);
}

export function projectJson(project: Project, plan: ManufacturingPlan, exportedAt: string): string {
  return JSON.stringify({
    format: 'modular-studio.project+calculation',
    schemaVersion: project.schemaVersion,
    calcVersion: CALC_VERSION,
    exportedAt,
    units: { length: 'mm', currency: 'MXN', money: 'centavos enteros' },
    releaseStatus: plan.calc.releaseStatus,
    project,
    calculation: plan.calc,
    nesting: plan.nesting,
    steel: plan.steel,
    quote: plan.quote,
  }, null, 2);
}

export function projectSvg(project: Project, plan: ManufacturingPlan, catalog: Catalog, opts: Partial<SceneOptions> = {}): string {
  return sceneToSvg(buildScene(project, plan.calc, catalog, { view: 'iso', exploded: false, showIds: false, hideFronts: false, ...opts }), 'light');
}

export function cutMapsSvg(plan: ManufacturingPlan): string[] {
  return plan.nesting.flatMap((n) => (n.layout ? n.layout.sheets.map((s) => cutSheetSvg({ materialName: n.materialName, sheet: n.layout!.sheet, index: s.index, utilization: s.utilization, placements: s.placements })) : []));
}

export function projectMermaid(project: Project, plan: ManufacturingPlan): string {
  return mermaidDiagram(project, plan.calc);
}

/** Expediente en texto plano (para impresión rápida / adjunto). */
export function summaryText(project: Project, plan: ManufacturingPlan): string {
  const lines = [
    `MODULAR STUDIO — ${project.name}`,
    `Cliente: ${project.customer || '—'} · Obra: ${project.site || '—'}`,
    `Estado: ${plan.calc.releaseStatus} · Cotización: ${plan.quote.completeness} · Total ${formatMXN(plan.quote.totalCents)}`,
    '',
    ...project.modules.flatMap((m) => [`${m.id} ${m.label} (${FAMILIES.find((f) => f.id === m.familyId)?.name ?? m.familyId}) ${m.widthMm}×${m.heightMm}×${m.depthMm} mm`, ...assemblySteps(m, plan.calc).map((s) => `  ${s.id} ${s.title}${s.pending ? ' [PENDIENTE]' : ''}`)]),
    '',
    'Checklist de calidad:',
    ...QC_CHECKLIST.map((c) => `  [${project.inspection.checklist[c.id] ? 'x' : ' '}] ${c.label}`),
  ];
  return lines.join('\n');
}
