import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import {
  CALC_VERSION, QC_CHECKLIST, assemblySteps, catalogLookup, diagonalChecks, formatMXN,
  type Catalog, type ManufacturingPlan, type Project,
} from '@ms/domain';
import { buildScene } from '@ms/geometry';

/** Las fuentes estándar PDF usan WinAnsi: se sustituyen caracteres fuera de ese juego. */
const REPL: Record<string, string> = { '≤': '<=', '≥': '>=', '−': '-', '→': '->', '↻': '(g)', '⚠': '!', '…': '...', '·': '·', ' ': ' ', '’': "'", '“': '"', '”': '"' };
export function pdfSafe(s: string): string {
  return [...s].map((c) => {
    if (REPL[c] !== undefined) return REPL[c];
    const code = c.codePointAt(0)!;
    if (code === 10 || (code >= 32 && code <= 126) || (code >= 160 && code <= 255) || '—–•€'.includes(c)) return c;
    return '?';
  }).join('');
}

const A4: [number, number] = [595.28, 841.89];
const M = 36;

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(readonly doc: PDFDocument, readonly font: PDFFont, readonly bold: PDFFont, readonly footer: string) { this.newPage(); }
  newPage() {
    this.page = this.doc.addPage(A4);
    this.y = A4[1] - M;
    this.page.drawText(pdfSafe(this.footer), { x: M, y: 18, size: 7, font: this.font, color: rgb(0.4, 0.4, 0.4) });
  }
  ensure(h: number) { if (this.y - h < M + 10) this.newPage(); }
  text(s: string, size = 9, bold = false, color = rgb(0.1, 0.13, 0.16)) {
    const f = bold ? this.bold : this.font;
    for (const line of wrap(pdfSafe(s), f, size, A4[0] - 2 * M)) {
      this.ensure(size + 4);
      this.page.drawText(line, { x: M, y: this.y - size, size, font: f, color });
      this.y -= size + 3;
    }
  }
  gap(h = 6) { this.y -= h; }
  h2(s: string) { this.gap(6); this.ensure(30); this.text(s, 12, true, rgb(0.06, 0.32, 0.4)); this.gap(2); }
  table(head: string[], rows: string[][], widths: number[], size = 7) {
    const total = widths.reduce((a, b) => a + b, 0);
    const scale = (A4[0] - 2 * M) / total;
    const ws = widths.map((w) => w * scale);
    const drawRow = (cells: string[], bold: boolean) => {
      const f = bold ? this.bold : this.font;
      const wrapped = cells.map((c, i) => wrap(pdfSafe(c), f, size, ws[i]! - 4));
      const h = Math.max(...wrapped.map((w) => w.length)) * (size + 2) + 4;
      this.ensure(h);
      if (bold) this.page.drawRectangle({ x: M, y: this.y - h, width: A4[0] - 2 * M, height: h, color: rgb(0.9, 0.94, 0.96) });
      let x = M;
      wrapped.forEach((lines, i) => {
        lines.forEach((ln, k) => this.page.drawText(ln, { x: x + 2, y: this.y - 2 - (k + 1) * (size + 2) + 2, size, font: f, color: rgb(0.1, 0.13, 0.16) }));
        x += ws[i]!;
      });
      this.page.drawLine({ start: { x: M, y: this.y - h }, end: { x: A4[0] - M, y: this.y - h }, thickness: 0.3, color: rgb(0.7, 0.75, 0.8) });
      this.y -= h;
    };
    drawRow(head, true);
    for (const r of rows) drawRow(r, false);
  }
}

function wrap(s: string, f: PDFFont, size: number, width: number): string[] {
  const out: string[] = [];
  for (const para of s.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const cand = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(cand, size) <= width) { line = cand; continue; }
      if (line) out.push(line);
      line = word;
      while (f.widthOfTextAtSize(line, size) > width && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && f.widthOfTextAtSize(line.slice(0, cut), size) > width) cut--;
        out.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    out.push(line);
  }
  return out;
}

function hexRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Expediente de fabricación PDF (A4). Marca explícitamente el estado de liberación. */
export async function buildPdf(project: Project, plan: ManufacturingPlan, catalog: Catalog, generatedAt: string): Promise<Uint8Array> {
  const L = catalogLookup(catalog);
  const doc = await PDFDocument.create();
  doc.setTitle(`Expediente ${project.name}`);
  doc.setProducer('Modular Studio');
  doc.setCreationDate(new Date(generatedAt));
  doc.setModificationDate(new Date(generatedAt));
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold, `Modular Studio · ${project.name} · cálculo ${CALC_VERSION} · ${generatedAt.slice(0, 10)} · Documento ${plan.calc.releaseStatus}. No sustituye cálculo estructural ni fichas de herraje.`);

  w.text('MODULAR STUDIO — EXPEDIENTE DE FABRICACIÓN', 15, true, rgb(0.06, 0.32, 0.4));
  w.text(`${project.name} · Cliente: ${project.customer || '—'} · Obra: ${project.site || '—'}`, 10, true);
  w.text(`Generado ${generatedAt} · esquema ${project.schemaVersion} · cálculo ${CALC_VERSION} · unidades mm / MXN`, 8);
  const status = plan.calc.releaseStatus;
  w.gap(4);
  w.text(`ESTADO: ${status}${status === 'LIBERADO_CON_APROBACION' && project.approval ? ` por ${project.approval.approvedBy} (${project.approval.approvedAt.slice(0, 10)})` : ' — NO LIBERADO PARA FABRICACIÓN'}`, 10, true, status === 'LIBERADO_CON_APROBACION' ? rgb(0.1, 0.45, 0.2) : rgb(0.7, 0.2, 0.1));

  // Isométrico vectorial a partir de la misma escena del editor
  const scene = buildScene(project, plan.calc, catalog, { view: 'iso', exploded: false, showIds: false, hideFronts: false, width: 900, height: 560 });
  const s = (A4[0] - 2 * M) / scene.width;
  w.ensure(scene.height * s + 10);
  const top = w.y;
  for (const p of scene.polygons) {
    const d = `M ${p.points.map((q) => `${q[0]} ${q[1]}`).join(' L ')} Z`;
    w.page.drawSvgPath(d, { x: M, y: top, scale: s, color: hexRgb(p.fill), borderColor: rgb(0.45, 0.52, 0.58), borderWidth: 0.4 });
  }
  for (const l of scene.lines) w.page.drawLine({ start: { x: M + l.x1 * s, y: top - l.y1 * s }, end: { x: M + l.x2 * s, y: top - l.y2 * s }, thickness: 0.8, color: rgb(0.7, 0.37, 0) });
  for (const t of scene.labels.filter((x) => x.kind === 'dim')) {
    const txt = pdfSafe(t.text);
    const tw = font.widthOfTextAtSize(txt, 8);
    const x = t.anchor === 'middle' ? t.x * s - tw / 2 : t.anchor === 'end' ? t.x * s - tw : t.x * s;
    w.page.drawText(txt, { x: M + x, y: top - t.y * s, size: 8, font: bold, color: rgb(0.7, 0.37, 0) });
  }
  w.y = top - scene.height * s - 6;
  w.text('Isométrico esquemático derivado del despiece; no es plano CNC ni render.', 7);

  w.h2('Módulos');
  w.table(['ID', 'Módulo', 'Familia', 'A×Al×F (mm)', 'Tablero', 'Frente', 'Base', 'Diagonal teórica'],
    project.modules.map((m) => {
      const r = plan.calc.modules.find((x) => x.moduleId === m.id);
      return [m.id, m.label, L.family(m.familyId).name, `${m.widthMm}×${m.heightMm}×${m.depthMm}`, `${L.material(m.materialId).name}`, m.front === 'doors' ? 'Puertas' : m.front === 'drawers' ? `${m.drawerCount} cajones` : 'Abierto', m.baseType, r?.theoreticalDiagonalMm ? `${r.theoreticalDiagonalMm} mm` : '—'];
    }), [30, 80, 80, 70, 90, 50, 45, 55]);

  w.h2('Lista de corte / despiece (medidas nominales antes de tapacanto)');
  w.table(['ID', 'Pieza', 'Cant.', 'Largo', 'Ancho', 'Esp.', 'Veta', 'Cantos L1/L2/A1/A2', 'Material', 'Estado'],
    plan.calc.parts.map((p) => [p.id, p.name, String(p.quantity), String(p.lengthMm), String(p.widthMm), String(p.thicknessMm), p.grainAxis,
      (['L1', 'L2', 'A1', 'A2'] as const).map((e) => (p.edgeBand[e] ? '1' : '0')).join('/'), L.material(p.materialId).name, p.validationStatus]),
    [70, 95, 25, 35, 35, 25, 35, 55, 70, 60]);
  for (const e of plan.calc.edgeBands) w.text(`Canto ${L.edgeBand(e.edgeBandId).name}: neto ${(e.netLengthMm / 1000).toFixed(2)} m en ${e.segments} tramos; compra ${(e.purchaseLengthMm / 1000).toFixed(2)} m (margen y merma).`, 8);

  w.h2('Tableros y acomodo');
  for (const n of plan.nesting) {
    w.text(`${n.materialName}: ${n.sheetsRequired === null ? `SIN CONFIRMAR (estimación por área ${n.areaEstimate.sheetsEstimated}, estimacion_area_no_validada)` : `${n.sheetsRequired} tablero(s) — layout_factible`}. ${n.note}`, 8);
  }

  w.h2('Herrajes (cantidades orientativas salvo ficha validada)');
  w.table(['Módulo', 'Categoría', 'Descripción', 'Cant.', 'Unidad', 'Regla', 'Estado'],
    plan.calc.hardware.map((h) => [h.moduleId, h.category, h.description, String(h.quantity), h.unit, h.basis, h.validationStatus]), [35, 55, 120, 30, 30, 150, 60]);

  if (plan.steel.length) {
    w.h2('Herrería (requiere validación estructural)');
    for (const s2 of plan.steel) {
      w.text(`${s2.profileName}: ${s2.layout.bars.length} barra(s) de ${s2.layout.barLengthMm} mm; corte total ${(s2.layout.totalCutLengthMm / 1000).toFixed(2)} m; masa ${s2.massKg ?? 'no calculada (sin kg/m de ficha)'}.`, 8);
    }
    w.table(['Pieza', 'Perfil', 'Largo (mm)', 'Cant.'], plan.calc.steel.flatMap((r) => r.pieces.map((p) => [p.label, r.sectionSpec, String(p.lengthMm), String(p.count)])), [100, 150, 60, 40]);
  }

  w.h2('Mecanizado');
  const pending = plan.calc.machining.filter((m) => m.validationStatus !== 'verified').length;
  w.text(`${plan.calc.machining.length} operaciones; ${pending} pendientes de ficha técnica (sin coordenadas). No perforar operaciones pendientes.`, 8);

  w.h2('Incidencias');
  const order = { error: 0, blocker: 1, warning: 2, info: 3 } as const;
  w.table(['Severidad', 'Código', 'Módulo', 'Mensaje'], [...plan.calc.issues].sort((a, b) => order[a.severity] - order[b.severity]).map((i) => [i.severity.toUpperCase(), i.code, i.moduleId ?? '', i.message]), [50, 110, 40, 300]);

  w.h2('Presupuesto');
  const q = plan.quote;
  w.text(`Estado: ${q.completeness}${q.completeness !== 'COMPLETO' ? ' — los importes son parciales o de simulación; NO es una cotización comercial vigente.' : ''}`, 9, true, q.completeness === 'COMPLETO' ? rgb(0.1, 0.45, 0.2) : rgb(0.7, 0.2, 0.1));
  w.table(['Concepto', 'Cant. compra', 'Proveedor / SKU', 'Neto unit.', 'Importe neto', 'Estado'],
    q.lines.filter((l) => l.status !== 'NOT_APPLICABLE').map((l) => [l.description, l.purchaseQuantity === null ? `${l.requiredQuantity} ${l.requiredUnit}` : `${l.purchaseQuantity} ${l.purchaseUnit ?? ''}`, l.supplierId ? `${l.supplierId} ${l.sku ?? ''}` : '—', formatMXN(l.unitNetCents), formatMXN(l.lineNetCents), `${l.status}${l.priceStatus ? ` (${l.priceStatus})` : ''}`]),
    [150, 55, 85, 55, 60, 80]);
  w.text(`Costo directo neto: ${formatMXN(q.directCostNetCents)} · Venta antes de IVA (${q.mode === 'margin' ? `margen ${q.marginPct} % sobre venta` : `markup ${q.markupPct} %`}): ${formatMXN(q.sellBeforeTaxCents)} · IVA ${q.taxRatePct} %: ${formatMXN(q.taxCents)} · Total: ${formatMXN(q.totalCents)}`, 9, true);
  for (const wn of q.warnings) w.text(`• ${wn}`, 8);

  w.h2('Secuencia constructiva');
  for (const m of project.modules) {
    w.text(`${m.id} · ${m.label}`, 9, true);
    for (const st of assemblySteps(m, plan.calc)) w.text(`${st.id} ${st.title}${st.pending ? ' [PENDIENTE DE VALIDACIÓN]' : ''}: ${st.detail}`, 8);
  }

  w.h2('Control de calidad');
  for (const c of QC_CHECKLIST) w.text(`[${project.inspection.checklist[c.id] ? 'X' : '  '}] ${c.label}`, 8);
  for (const d of diagonalChecks(project, plan.calc)) w.text(`${d.moduleId}: diagonales ${d.d1Mm ?? '—'} / ${d.d2Mm ?? '—'} mm · diferencia ${d.differenceMm ?? '—'} · tolerancia ${d.toleranceMm} mm · ${d.result}`, 8);
  w.gap(20);
  w.text('Revisó: ______________________    Aprobó: ______________________    Fecha: ____________', 9);
  return doc.save();
}
