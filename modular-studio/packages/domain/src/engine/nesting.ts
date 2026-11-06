import { estimateSheetsByArea, optimizeBars, optimizeSheets, type AreaEstimate, type CutLayoutResult, type LinearResult } from '@ms/cut-optimizer';
import { catalogLookup, type Catalog } from '../catalog';
import type { CutSettings, PanelPart, SteelRequirement } from '../types';

export interface MaterialNesting {
  materialId: string;
  materialName: string;
  productKey: string;
  thicknessMm: number;
  layout: CutLayoutResult | null;
  areaEstimate: AreaEstimate;
  /** Tableros a comprar: sólo definido cuando hay acomodo factible. */
  sheetsRequired: number | null;
  note: string;
}

export interface SteelNesting {
  profileId: string;
  profileName: string;
  productKey: string;
  layout: LinearResult;
  totalLengthM: number;
  massKg: number | null;
}

/** Agrupa piezas por material y ejecuta el acomodo 2D. Respeta veta si el acabado la tiene. */
export function nestParts(parts: PanelPart[], catalog: Catalog, cut: CutSettings): MaterialNesting[] {
  const L = catalogLookup(catalog);
  const groups = new Map<string, PanelPart[]>();
  for (const p of parts) groups.set(p.materialId, [...(groups.get(p.materialId) ?? []), p]);
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([materialId, list]) => {
    const m = L.material(materialId);
    const pieces = list.map((p) => ({
      partId: p.id, label: p.code, lengthMm: p.lengthMm, widthMm: p.widthMm, quantity: p.quantity,
      canRotate: p.grainAxis === 'none' || !L.finish(p.finishId).hasGrain || m.kind === 'back_panel',
    }));
    const sheet = m.sheet ? { lengthMm: m.sheet.lengthMm, widthMm: m.sheet.widthMm, kerfMm: cut.kerfMm, trimMarginMm: cut.trimMarginMm } : { lengthMm: 2440, widthMm: 1220, kerfMm: cut.kerfMm, trimMarginMm: cut.trimMarginMm };
    const areaEstimate = estimateSheetsByArea(pieces, sheet);
    if (!m.sheet) {
      return { materialId, materialName: m.name, productKey: m.productKey, thicknessMm: m.thicknessMm, layout: null, areaEstimate, sheetsRequired: null, note: 'Material sin formato de tablero (madera maciza): cotizar por pieza/pie-tabla; la estimación por área no es válida para compra.' };
    }
    const layout = optimizeSheets(pieces, sheet);
    return {
      materialId, materialName: m.name, productKey: m.productKey, thicknessMm: m.thicknessMm, layout, areaEstimate,
      sheetsRequired: layout.status === 'layout_factible' ? layout.sheets.length : null,
      note: layout.status === 'layout_factible'
        ? `Acomodo guillotina factible con kerf ${cut.kerfMm} mm y escuadrado ${cut.trimMarginMm} mm por lado. Validar en optimizador del taller.`
        : 'Hay piezas sin acomodo: el número de tableros NO está confirmado.',
    };
  });
}

export function nestSteel(steel: SteelRequirement[], catalog: Catalog, kerfMm = 3, wastePct = 0): SteelNesting[] {
  const L = catalogLookup(catalog);
  const groups = new Map<string, SteelRequirement[]>();
  for (const s of steel) groups.set(s.profileId, [...(groups.get(s.profileId) ?? []), s]);
  return [...groups.entries()].map(([profileId, reqs]) => {
    const prof = L.steelProfile(profileId);
    const layout = optimizeBars(reqs.flatMap((r) => r.pieces), prof.barLengthMm, kerfMm, wastePct);
    const totalLengthM = Math.round(layout.totalCutLengthMm) / 1000;
    return { profileId, profileName: prof.name, productKey: prof.productKey, layout, totalLengthM, massKg: prof.kgPerM === null ? null : Math.round(prof.kgPerM * totalLengthM * 100) / 100 };
  });
}
