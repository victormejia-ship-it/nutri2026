/**
 * Optimizador de corte 2D (guillotina, Best Short Side Fit) y 1D (First Fit Decreasing).
 *
 * - Considera kerf (ancho de disco), margen de escuadrado por lado, veta y rotación permitida.
 * - Sólo un acomodo geométrico factible produce `layout_factible`. La estimación por área
 *   se rotula siempre `estimacion_area_no_validada` y nunca confirma número de tableros.
 * - No considera defectos del tablero, retazos en inventario ni secuencia de seccionadora.
 */

export interface CutPiece {
  /** ID de pieza (modelo) del BOM. */
  partId: string;
  label: string;
  /** Dimensión a lo largo de la veta de la pieza. */
  lengthMm: number;
  widthMm: number;
  quantity: number;
  /** true => puede girarse 90° (sin veta relevante). */
  canRotate: boolean;
}

export interface SheetSpec {
  /** Largo del tablero (dirección de la veta del tablero). */
  lengthMm: number;
  widthMm: number;
  kerfMm: number;
  trimMarginMm: number;
}

export interface Placement {
  partId: string;
  label: string;
  instance: number;
  x: number;
  y: number;
  /** Dimensión ocupada sobre el eje X del tablero (largo del tablero). */
  w: number;
  h: number;
  rotated: boolean;
}

export interface SheetLayout {
  index: number;
  placements: Placement[];
  usedAreaMm2: number;
  utilization: number;
}

export interface CutLayoutResult {
  method: 'guillotine_bssf';
  status: 'layout_factible' | 'layout_incompleto';
  sheet: SheetSpec;
  sheets: SheetLayout[];
  unplaced: { partId: string; label: string; instance: number; reason: string }[];
  totalPieces: number;
}

export interface AreaEstimate {
  status: 'estimacion_area_no_validada';
  sheetsEstimated: number;
  pieceAreaM2: number;
  wastePct: number;
}

interface FreeRect { x: number; y: number; w: number; h: number }

/** Estimación por área. NO es un acomodo: siempre se rotula como no validada. */
export function estimateSheetsByArea(pieces: CutPiece[], sheet: SheetSpec, wastePct = 15): AreaEstimate {
  const area = pieces.reduce((s, p) => s + p.lengthMm * p.widthMm * p.quantity, 0);
  const usable = (sheet.lengthMm - 2 * sheet.trimMarginMm) * (sheet.widthMm - 2 * sheet.trimMarginMm);
  return {
    status: 'estimacion_area_no_validada',
    sheetsEstimated: usable > 0 ? Math.ceil((area * (1 + wastePct / 100)) / usable) : 0,
    pieceAreaM2: Math.round((area / 1e6) * 1000) / 1000,
    wastePct,
  };
}

export function optimizeSheets(pieces: CutPiece[], sheet: SheetSpec, maxSheets = 200): CutLayoutResult {
  const k = sheet.kerfMm;
  const usableW = sheet.lengthMm - 2 * sheet.trimMarginMm;
  const usableH = sheet.widthMm - 2 * sheet.trimMarginMm;
  const items = pieces
    .flatMap((p) => Array.from({ length: p.quantity }, (_, i) => ({ ...p, instance: i + 1 })))
    // Orden determinista: área desc, lado mayor desc, ID.
    .sort((a, b) => b.lengthMm * b.widthMm - a.lengthMm * a.widthMm || Math.max(b.lengthMm, b.widthMm) - Math.max(a.lengthMm, a.widthMm) || a.partId.localeCompare(b.partId) || a.instance - b.instance);

  const sheets: { free: FreeRect[]; layout: SheetLayout }[] = [];
  const unplaced: CutLayoutResult['unplaced'] = [];
  const newSheet = () => {
    const s = { free: [{ x: sheet.trimMarginMm, y: sheet.trimMarginMm, w: usableW + k, h: usableH + k }], layout: { index: sheets.length + 1, placements: [], usedAreaMm2: 0, utilization: 0 } as SheetLayout };
    sheets.push(s);
    return s;
  };

  for (const it of items) {
    const orientations: { w: number; h: number; rotated: boolean }[] = [{ w: it.lengthMm, h: it.widthMm, rotated: false }];
    if (it.canRotate && it.lengthMm !== it.widthMm) orientations.push({ w: it.widthMm, h: it.lengthMm, rotated: true });
    const fitsEmpty = orientations.some((o) => o.w <= usableW && o.h <= usableH);
    if (!fitsEmpty) {
      unplaced.push({ partId: it.partId, label: it.label, instance: it.instance, reason: `No cabe en tablero útil ${usableW} × ${usableH} mm${it.canRotate ? '' : ' respetando veta'}` });
      continue;
    }
    let placed = false;
    for (const s of sheets) {
      if (place(s, it, orientations, k)) { placed = true; break; }
    }
    if (!placed) {
      if (sheets.length >= maxSheets) {
        unplaced.push({ partId: it.partId, label: it.label, instance: it.instance, reason: 'Límite de tableros alcanzado' });
        continue;
      }
      const s = newSheet();
      if (!place(s, it, orientations, k)) unplaced.push({ partId: it.partId, label: it.label, instance: it.instance, reason: 'Sin acomodo' });
    }
  }

  const layouts = sheets.map((s) => {
    s.layout.utilization = Math.round((s.layout.usedAreaMm2 / (sheet.lengthMm * sheet.widthMm)) * 1000) / 1000;
    return s.layout;
  });
  return {
    method: 'guillotine_bssf',
    status: unplaced.length ? 'layout_incompleto' : 'layout_factible',
    sheet,
    sheets: layouts,
    unplaced,
    totalPieces: items.length,
  };
}

function place(
  s: { free: FreeRect[]; layout: SheetLayout },
  it: { partId: string; label: string; instance: number },
  orientations: { w: number; h: number; rotated: boolean }[],
  k: number,
): boolean {
  let best: { ri: number; o: (typeof orientations)[number]; score: number; score2: number } | null = null;
  s.free.forEach((r, ri) => {
    for (const o of orientations) {
      const ow = o.w + k, oh = o.h + k;
      if (ow <= r.w + 1e-9 && oh <= r.h + 1e-9) {
        const score = Math.min(r.w - ow, r.h - oh);
        const score2 = Math.max(r.w - ow, r.h - oh);
        if (!best || score < best.score || (score === best.score && score2 < best.score2)) best = { ri, o, score, score2 };
      }
    }
  });
  if (!best) return false;
  const { ri, o } = best as { ri: number; o: (typeof orientations)[number] };
  const r = s.free[ri]!;
  s.layout.placements.push({ partId: it.partId, label: it.label, instance: it.instance, x: r.x, y: r.y, w: o.w, h: o.h, rotated: o.rotated });
  s.layout.usedAreaMm2 += o.w * o.h;
  // Corte guillotina: dividir por el eje de menor sobrante (Shorter Leftover Axis).
  const ow = o.w + k, oh = o.h + k;
  const rightW = r.w - ow, topH = r.h - oh;
  const splitHorizontal = rightW < topH;
  const right: FreeRect = splitHorizontal ? { x: r.x + ow, y: r.y, w: rightW, h: oh } : { x: r.x + ow, y: r.y, w: rightW, h: r.h };
  const top: FreeRect = splitHorizontal ? { x: r.x, y: r.y + oh, w: r.w, h: topH } : { x: r.x, y: r.y + oh, w: ow, h: topH };
  s.free.splice(ri, 1);
  for (const f of [right, top]) if (f.w > k && f.h > k) s.free.push(f);
  return true;
}

// ---------------------------------------------------------------------------
// 1D: barras (PTR, perfiles, tubo de colgar)
// ---------------------------------------------------------------------------

export interface LinearPiece { id: string; label: string; lengthMm: number; count: number }
export interface BarLayout { index: number; cuts: { id: string; label: string; lengthMm: number }[]; usedMm: number; remainderMm: number }
export interface LinearResult { method: 'first_fit_decreasing'; status: 'layout_factible' | 'layout_incompleto'; barLengthMm: number; kerfMm: number; bars: BarLayout[]; unplaced: string[]; totalCutLengthMm: number }

export function optimizeBars(pieces: LinearPiece[], barLengthMm: number, kerfMm: number, wastePct = 0): LinearResult {
  const items = pieces
    .flatMap((p) => Array.from({ length: p.count }, () => ({ id: p.id, label: p.label, lengthMm: p.lengthMm * (1 + wastePct / 100) })))
    .sort((a, b) => b.lengthMm - a.lengthMm || a.id.localeCompare(b.id));
  const bars: BarLayout[] = [];
  const unplaced: string[] = [];
  for (const it of items) {
    if (it.lengthMm > barLengthMm) { unplaced.push(it.id); continue; }
    let bar = bars.find((b) => b.usedMm + (b.cuts.length ? kerfMm : 0) + it.lengthMm <= barLengthMm);
    if (!bar) { bar = { index: bars.length + 1, cuts: [], usedMm: 0, remainderMm: barLengthMm }; bars.push(bar); }
    bar.usedMm += (bar.cuts.length ? kerfMm : 0) + it.lengthMm;
    bar.cuts.push({ id: it.id, label: it.label, lengthMm: Math.round(it.lengthMm * 100) / 100 });
    bar.remainderMm = Math.round((barLengthMm - bar.usedMm) * 100) / 100;
  }
  return {
    method: 'first_fit_decreasing',
    status: unplaced.length ? 'layout_incompleto' : 'layout_factible',
    barLengthMm, kerfMm, bars, unplaced,
    totalCutLengthMm: Math.round(items.reduce((s, x) => s + x.lengthMm, 0) * 100) / 100,
  };
}
