import { parseOffer } from '../project/schema';
import type { SupplierOffer } from '../types';

/** Columnas aceptadas en el CSV de ofertas (encabezados en la primera fila). */
export const OFFER_CSV_COLUMNS = [
  'supplierId', 'productKey', 'sku', 'description', 'packQuantity', 'purchaseUnit', 'price', 'taxIncluded', 'taxRatePct',
  'priceStatus', 'verifiedAt', 'validUntil', 'sourceUrl', 'quoteReference', 'available', 'reliability', 'capturedBy', 'notes',
] as const;

/** Parser CSV RFC 4180 (comillas, comas/; y saltos de línea dentro de campos). Detecta separador. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [], field = '', q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

/** "1,234.50" | "1234,50" | "$1 234.50" -> centavos. null si vacío. */
export function parseMoneyToCents(s: string): number | null {
  const t = s.replace(/[$\s]|MXN/gi, '');
  if (t === '') return null;
  let norm = t;
  if (/,\d{1,2}$/.test(t) && !/\.\d{1,2}$/.test(t)) norm = t.replace(/\./g, '').replace(',', '.');
  else norm = t.replace(/,/g, '');
  const n = Number(norm);
  if (!Number.isFinite(n) || n < 0) throw new Error(`Importe inválido: "${s}"`);
  return Math.round(n * 100);
}

const bool = (s: string | undefined): boolean | null => {
  const t = (s ?? '').trim().toLowerCase();
  if (['true', 'si', 'sí', '1', 'yes', 'incluido'].includes(t)) return true;
  if (['false', 'no', '0', 'excluido'].includes(t)) return false;
  return null;
};
const nul = (s: string | undefined) => { const t = (s ?? '').trim(); return t === '' ? null : t; };

export interface ImportResult {
  offers: SupplierOffer[];
  errors: { row: number; message: string }[];
  duplicates: number;
}

export function offerDedupKey(o: SupplierOffer): string {
  return [o.supplierId, o.sku, o.packQuantity, o.purchaseUnit, o.verifiedAt ?? '', o.quoteReference ?? ''].join('|').toLowerCase();
}

/**
 * Importa ofertas desde CSV. Valida unidades, estados e IVA; de-duplica por
 * proveedor + SKU + presentación + fecha. No sobrescribe ofertas existentes (histórico).
 */
export function importOffersCsv(text: string, existing: SupplierOffer[], idPrefix: string, knownSuppliers: string[]): ImportResult {
  const rows = parseCsv(text);
  const errors: ImportResult['errors'] = [];
  if (rows.length < 2) return { offers: [], errors: [{ row: 1, message: 'El CSV no tiene filas de datos.' }], duplicates: 0 };
  const header = rows[0]!.map((h) => h.trim());
  const missingCols = ['supplierId', 'productKey', 'sku', 'packQuantity', 'purchaseUnit', 'priceStatus'].filter((c) => !header.includes(c));
  if (missingCols.length) return { offers: [], errors: [{ row: 1, message: `Faltan columnas: ${missingCols.join(', ')}` }], duplicates: 0 };
  const seen = new Set(existing.map(offerDedupKey));
  const offers: SupplierOffer[] = [];
  let duplicates = 0;
  rows.slice(1).forEach((cells, i) => {
    const rowNo = i + 2;
    const get = (k: string) => cells[header.indexOf(k)]?.trim() ?? '';
    try {
      if (!knownSuppliers.includes(get('supplierId'))) throw new Error(`Proveedor desconocido: ${get('supplierId')}`);
      const priceStatus = get('priceStatus').toUpperCase();
      const offer = parseOffer({
        id: `${idPrefix}-${rowNo}`,
        supplierId: get('supplierId'), productKey: get('productKey'), sku: get('sku'), description: get('description'),
        packQuantity: Number(get('packQuantity').replace(',', '.')), purchaseUnit: get('purchaseUnit'), currency: 'MXN',
        priceCents: parseMoneyToCents(get('price')), taxIncluded: bool(get('taxIncluded')),
        taxRatePct: nul(get('taxRatePct')) === null ? null : Number(get('taxRatePct')),
        priceStatus, verifiedAt: nul(get('verifiedAt')), validUntil: nul(get('validUntil')), sourceUrl: nul(get('sourceUrl')),
        quoteReference: nul(get('quoteReference')), available: bool(get('available')),
        reliability: (nul(get('reliability')) ?? 'media').toLowerCase(), capturedBy: nul(get('capturedBy')), notes: get('notes'),
      });
      const key = offerDedupKey(offer);
      if (seen.has(key)) { duplicates++; return; }
      seen.add(key);
      offers.push(offer);
    } catch (e) {
      errors.push({ row: rowNo, message: (e as Error).message });
    }
  });
  return { offers, errors, duplicates };
}
