import type { Supplier, SupplierOffer } from '../types';

/**
 * Proveedores prioritarios. No se afirma afiliación, certificación ni colaboración comercial.
 * Las URLs "candidatas" provienen del prototipo y requieren verificación del dominio oficial.
 */
export const SUPPLIERS: Supplier[] = [
  {
    id: 'sarotech', name: 'Sarotech', categories: ['hardware', 'profiles'], officialUrl: null, catalogUrl: null,
    candidateUrl: 'https://sarotech.io/', verification: 'URL_PENDIENTE_VERIFICACION', priceMode: 'QUOTE_OR_AUTHORIZED_IMPORT',
    notes: 'Herrajes, perfiles y accesorios. Confirmar dominio oficial y permisos de integración.',
  },
  {
    id: 'tym_forest', name: 'TYM Forest', categories: ['boards', 'hardware', 'adhesives'], officialUrl: null, catalogUrl: null,
    candidateUrl: 'https://www.tymforest.com/', verification: 'URL_PENDIENTE_VERIFICACION', priceMode: 'QUOTE_OR_AUTHORIZED_IMPORT',
    notes: 'Tableros y herrajes. Confirmar dominio oficial, unidades y precios por variante.',
  },
  {
    id: 'pajaro_carpintero', name: 'El Pájaro Carpintero', categories: ['boards', 'laminates', 'cutting_services', 'edgebanding_services'],
    officialUrl: 'https://www.elpajarocarpintero.mx/', catalogUrl: 'https://www.elpajarocarpintero.mx/productos/', candidateUrl: null,
    verification: 'PUBLIC_CATALOG', priceMode: 'QUOTE_OR_AUTHORIZED_IMPORT',
    notes: 'Melaminas, laminados y tableros; servicios de dimensionado y enchapado. El catálogo público no necesariamente muestra precios.',
  },
];

const base = {
  currency: 'MXN' as const, taxRatePct: 16, validUntil: null, quoteReference: null, available: null, capturedBy: 'prototipo-html',
};

/**
 * Ofertas DEMO tomadas del módulo de costos del prototipo HTML (fecha 2026-11-06).
 * No hay comprobante de SKU/fecha integrado, por lo que se registran como ESTIMADO (sólo simulación).
 * `data/seed/supplier_offers.json` (ofertas verificables) inicia vacío por política.
 */
export const DEMO_OFFERS: SupplierOffer[] = [
  { ...base, id: 'demo-tym-hinge-master', supplierId: 'tym_forest', productKey: 'hw:samet:SAM1010041150', sku: 'SAM1010041150', description: 'Bisagra Master 110°, bolsa de 2 kits', packQuantity: 2, purchaseUnit: 'bolsa', priceCents: 5700, taxIncluded: true, priceStatus: 'ESTIMADO', verifiedAt: null, sourceUrl: 'https://www.tymforest.com/producto/bisagra-110-samet-cierre-suave', reliability: 'baja', notes: 'Valor del prototipo; verificar en la fuente antes de uso comercial.' },
  { ...base, id: 'demo-tym-slide-soclass', supplierId: 'tym_forest', productKey: 'hw:samet:SAM11662153004', sku: 'SAM11662153004', description: 'Corredera SO Class 350 mm (verificar presentación)', packQuantity: 1, purchaseUnit: 'pieza', priceCents: 14800, taxIncluded: true, priceStatus: 'ESTIMADO', verifiedAt: null, sourceUrl: 'https://www.tymforest.com/producto/corredera-so-class-cierre-lento', reliability: 'baja', notes: 'El prototipo indica precio por pieza: confirmar si es juego completo.' },
  { ...base, id: 'demo-tym-slide-smart', supplierId: 'tym_forest', productKey: 'hw:samet:SAM127240533', sku: 'SAM127240533', description: 'Corredera SmartSlide 350 mm, kit (cajón 16 mm)', packQuantity: 1, purchaseUnit: 'kit', priceCents: 32400, taxIncluded: true, priceStatus: 'ESTIMADO', verifiedAt: null, sourceUrl: 'https://www.tymforest.com/producto/corredera-oculta-smartslide-cierre-suave', reliability: 'baja', notes: 'Valor del prototipo.' },
  { ...base, id: 'demo-tym-spax', supplierId: 'tym_forest', productKey: 'hw:spax:SP044015', sku: 'SP044015', description: 'Tornillo Spax 4×15 mm, caja 1000 pzas', packQuantity: 1000, purchaseUnit: 'caja', priceCents: 56700, taxIncluded: true, priceStatus: 'ESTIMADO', verifiedAt: null, sourceUrl: 'https://www.tymforest.com/catalogo/complementos/herrajes/spax', reliability: 'baja', notes: 'Compra de caja completa.' },
  { ...base, id: 'demo-tym-formica', supplierId: 'tym_forest', productKey: 'board:lam18', sku: 'TFOR-912-58', description: 'Tablero Formica Storm Matte 18 mm 1220×2440', packQuantity: 1, purchaseUnit: 'hoja', priceCents: 290000, taxIncluded: true, priceStatus: 'ESTIMADO', verifiedAt: null, sourceUrl: 'https://www.tymforest.com/catalogo/tableros/tablero-laminado/tablero-formica', reliability: 'baja', notes: 'Laminado: no comparable con melamina.' },
  { ...base, id: 'demo-saro-profile', supplierId: 'sarotech', productKey: 'profile:alu_c_black_2980', sku: '10189', description: 'Perfil aluminio negro tipo C, 2.98 m', packQuantity: 1, purchaseUnit: 'barra', priceCents: null, taxIncluded: null, taxRatePct: null, priceStatus: 'PENDIENTE', verifiedAt: null, sourceUrl: 'https://sarotech.io/productos/perfil-aluminio', reliability: 'baja', notes: 'Solicitar cotización.' },
  { ...base, id: 'demo-pajaro-mel18', supplierId: 'pajaro_carpintero', productKey: 'board:mel18', sku: 'CAT-MEL', description: 'Melamina 18 mm 1220×2440 (según artículo)', packQuantity: 1, purchaseUnit: 'hoja', priceCents: null, taxIncluded: null, taxRatePct: null, priceStatus: 'PENDIENTE', verifiedAt: null, sourceUrl: 'https://www.elpajarocarpintero.mx/productos/', reliability: 'media', notes: 'Solicitar cotización.' },
];
