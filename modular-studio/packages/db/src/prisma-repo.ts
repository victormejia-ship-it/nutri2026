import { PrismaClient, Prisma } from '@prisma/client';
import {
  ConcurrencyError, NotFoundError, parseProject,
  type Project, type ProjectRevisionRecord, type ProjectSummary, type Repository, type SupplierOffer,
} from '@ms/domain';

type OfferRow = Prisma.SupplierOfferGetPayload<object>;

const toOffer = (r: OfferRow): SupplierOffer => ({
  id: r.id, supplierId: r.supplierId, productKey: r.productKey, sku: r.sku, description: r.description,
  packQuantity: Number(r.packQuantity), purchaseUnit: r.purchaseUnit, currency: 'MXN', priceCents: r.priceCents,
  taxIncluded: r.taxIncluded, taxRatePct: r.taxRatePct === null ? null : Number(r.taxRatePct),
  priceStatus: r.priceStatus as SupplierOffer['priceStatus'], verifiedAt: r.verifiedAt, validUntil: r.validUntil, sourceUrl: r.sourceUrl,
  quoteReference: r.quoteReference, available: r.available, reliability: r.reliability as SupplierOffer['reliability'], capturedBy: r.capturedBy, notes: r.notes,
});

/** Repositorio PostgreSQL. Las consultas siempre filtran por workspaceId. */
export class PrismaRepository implements Repository {
  readonly kind = 'prisma' as const;
  constructor(private readonly db: PrismaClient = new PrismaClient()) {}

  private async ensureWorkspace(workspaceId: string) {
    await this.db.workspace.upsert({ where: { id: workspaceId }, create: { id: workspaceId, name: workspaceId }, update: {} });
  }

  async listProjects(workspaceId: string): Promise<ProjectSummary[]> {
    const rows = await this.db.project.findMany({ where: { workspaceId }, orderBy: { updatedAt: 'desc' }, include: { _count: { select: { revisions: true } } } });
    return rows.map((r) => ({ id: r.id, name: r.name, customer: r.customer, updatedAt: r.updatedAt.toISOString(), moduleCount: (r.data as unknown as Project).modules.length, revisionCount: r._count.revisions }));
  }

  async getProject(workspaceId: string, id: string): Promise<Project | null> {
    const r = await this.db.project.findFirst({ where: { id, workspaceId } });
    return r ? parseProject(r.data) : null;
  }

  async createProject(workspaceId: string, p: Project): Promise<Project> {
    await this.ensureWorkspace(workspaceId);
    await this.db.project.create({ data: { id: p.id, workspaceId, name: p.name, customer: p.customer, schemaVersion: p.schemaVersion, data: p as unknown as Prisma.InputJsonValue, updatedAt: new Date(p.updatedAt) } });
    return p;
  }

  async updateProject(workspaceId: string, p: Project, expectedUpdatedAt?: string): Promise<Project> {
    const res = await this.db.project.updateMany({
      where: { id: p.id, workspaceId, ...(expectedUpdatedAt ? { updatedAt: new Date(expectedUpdatedAt) } : {}) },
      data: { name: p.name, customer: p.customer, schemaVersion: p.schemaVersion, data: p as unknown as Prisma.InputJsonValue, updatedAt: new Date(p.updatedAt) },
    });
    if (res.count === 0) {
      const exists = await this.db.project.findFirst({ where: { id: p.id, workspaceId }, select: { id: true } });
      if (!exists) throw new NotFoundError(`Proyecto ${p.id} no encontrado`);
      throw new ConcurrencyError('El proyecto cambió desde que se abrió; recargue antes de guardar.');
    }
    return p;
  }

  async deleteProject(workspaceId: string, id: string): Promise<void> {
    await this.db.project.deleteMany({ where: { id, workspaceId } });
  }

  async listRevisions(workspaceId: string, projectId: string) {
    const rows = await this.db.projectRevision.findMany({ where: { projectId, project: { workspaceId } }, orderBy: { number: 'desc' }, omit: { snapshot: true } });
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString(), releaseStatus: r.releaseStatus as ProjectRevisionRecord['releaseStatus'], quoteCompleteness: r.quoteCompleteness as ProjectRevisionRecord['quoteCompleteness'] }));
  }

  async getRevision(workspaceId: string, projectId: string, revisionId: string): Promise<ProjectRevisionRecord | null> {
    const r = await this.db.projectRevision.findFirst({ where: { id: revisionId, projectId, project: { workspaceId } } });
    if (!r) return null;
    return { ...r, createdAt: r.createdAt.toISOString(), releaseStatus: r.releaseStatus as ProjectRevisionRecord['releaseStatus'], quoteCompleteness: r.quoteCompleteness as ProjectRevisionRecord['quoteCompleteness'], snapshot: parseProject(r.snapshot) };
  }

  async createRevision(workspaceId: string, rec: Omit<ProjectRevisionRecord, 'id' | 'number'>): Promise<ProjectRevisionRecord> {
    return this.db.$transaction(async (tx) => {
      const project = await tx.project.findFirst({ where: { id: rec.projectId, workspaceId }, select: { id: true } });
      if (!project) throw new NotFoundError(`Proyecto ${rec.projectId} no encontrado`);
      const last = await tx.projectRevision.aggregate({ where: { projectId: rec.projectId }, _max: { number: true } });
      const row = await tx.projectRevision.create({
        data: { projectId: rec.projectId, number: (last._max.number ?? 0) + 1, note: rec.note, author: rec.author, schemaVersion: rec.schemaVersion, calcVersion: rec.calcVersion, releaseStatus: rec.releaseStatus, quoteCompleteness: rec.quoteCompleteness, snapshot: rec.snapshot as unknown as Prisma.InputJsonValue, createdAt: new Date(rec.createdAt) },
      });
      return { ...rec, id: row.id, number: row.number };
    });
  }

  async listOffers(workspaceId: string): Promise<SupplierOffer[]> {
    return (await this.db.supplierOffer.findMany({ where: { workspaceId }, orderBy: [{ productKey: 'asc' }, { createdAt: 'asc' }] })).map(toOffer);
  }

  async addOffers(workspaceId: string, offers: SupplierOffer[]): Promise<number> {
    await this.ensureWorkspace(workspaceId);
    const res = await this.db.supplierOffer.createMany({
      data: offers.map((o) => ({ ...o, workspaceId, packQuantity: new Prisma.Decimal(o.packQuantity), taxRatePct: o.taxRatePct === null ? null : new Prisma.Decimal(o.taxRatePct) })),
      skipDuplicates: true,
    });
    return res.count;
  }
}
