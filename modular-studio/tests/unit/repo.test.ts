import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { CALC_VERSION, ConcurrencyError, DEFAULT_CATALOG, createProject, type Repository } from '@ms/domain';
import { FileRepository } from '../../apps/web/src/server/file-repo';

const NOW = '2026-01-01T00:00:00.000Z';

function contract(name: string, make: () => Promise<Repository>, ws: string) {
  describe(`repositorio ${name}`, () => {
    it('CRUD, concurrencia optimista, revisiones y ofertas acotadas por workspace', async () => {
      const repo = await make();
      const id = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const p = createProject({ id, name: 'Repo test', familyId: 'wardrobe', now: NOW }, DEFAULT_CATALOG);
      await repo.createProject(ws, p);
      expect((await repo.getProject(ws, id))?.name).toBe('Repo test');
      expect(await repo.getProject(`${ws}-otro`, id)).toBeNull();

      const updated = { ...p, name: 'Renombrado', updatedAt: '2026-01-02T00:00:00.000Z' };
      await repo.updateProject(ws, updated, p.updatedAt);
      await expect(repo.updateProject(ws, { ...updated, updatedAt: '2026-01-03T00:00:00.000Z' }, p.updatedAt)).rejects.toBeInstanceOf(ConcurrencyError);

      const r1 = await repo.createRevision(ws, { projectId: id, createdAt: NOW, note: 'r1', author: 'test', schemaVersion: p.schemaVersion, calcVersion: CALC_VERSION, releaseStatus: 'PENDIENTE_VALIDACION', quoteCompleteness: 'INCOMPLETO', snapshot: updated });
      const r2 = await repo.createRevision(ws, { ...r1, note: 'r2' });
      expect([r1.number, r2.number]).toEqual([1, 2]);
      const list = await repo.listRevisions(ws, id);
      expect(list.map((r) => r.number)).toEqual([2, 1]);
      expect((await repo.getRevision(ws, id, r1.id))?.snapshot).toEqual(updated);

      const before = (await repo.listOffers(ws)).length;
      const offer = { id: `o-${id}`, supplierId: 'tym_forest', productKey: 'board:mel18', sku: `S-${id}`, description: '', packQuantity: 1, purchaseUnit: 'hoja', currency: 'MXN' as const, priceCents: 1000, taxIncluded: false, taxRatePct: 16, priceStatus: 'COTIZADO' as const, verifiedAt: '2026-01-01', validUntil: null, sourceUrl: null, quoteReference: 'F', available: null, reliability: 'media' as const, capturedBy: 't', notes: '' };
      expect(await repo.addOffers(ws, [offer])).toBe(1);
      expect(await repo.addOffers(ws, [{ ...offer, id: `o2-${id}` }])).toBe(0);
      expect((await repo.listOffers(ws)).length).toBe(before + 1);

      await repo.deleteProject(ws, id);
      expect(await repo.getProject(ws, id)).toBeNull();
    });
  });
}

contract('archivo (demo)', async () => new FileRepository(path.join(await mkdtemp(path.join(os.tmpdir(), 'ms-repo-')), 'db.json')), 'demo');

if (process.env.DATABASE_URL) {
  contract('PostgreSQL (Prisma)', async () => {
    const { PrismaRepository } = await import('@ms/db');
    return new PrismaRepository();
  }, `test-${Date.now().toString(36)}`);
} else {
  describe.skip('repositorio PostgreSQL (Prisma) — defina DATABASE_URL para ejecutarlo', () => { it('omitido', () => undefined); });
}
