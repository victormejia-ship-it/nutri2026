/**
 * Seed de PostgreSQL: proveedores (sin afiliación), workspace demo y ofertas DEMO marcadas ESTIMADO.
 * data/seed/supplier_offers.json (ofertas verificables) se importa si contiene registros.
 */
import { readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { DEMO_OFFERS, SUPPLIERS, parseOffer } from '@ms/domain';
import { PrismaRepository } from './prisma-repo';

const db = new PrismaClient();
const ws = process.env.DEMO_WORKSPACE_ID ?? 'demo';
for (const s of SUPPLIERS) {
  await db.supplier.upsert({ where: { id: s.id }, create: { ...s }, update: { ...s } });
}
const repo = new PrismaRepository(db);
const verified = (JSON.parse(readFileSync(new URL('../../../data/seed/supplier_offers.json', import.meta.url), 'utf8')) as unknown[]).map(parseOffer);
const n = await repo.addOffers(ws, [...DEMO_OFFERS, ...verified]);
console.log(`Seed OK: ${SUPPLIERS.length} proveedores, ${n} ofertas nuevas en workspace "${ws}" (${verified.length} verificables).`);
await db.$disconnect();
