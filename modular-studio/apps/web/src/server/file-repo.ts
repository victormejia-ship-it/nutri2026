import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ConcurrencyError, DEFAULT_CATALOG, DEMO_OFFERS, NotFoundError, createModule, createProject, offerDedupKey, parseProject,
  type Project, type ProjectRevisionRecord, type ProjectSummary, type Repository, type SupplierOffer,
} from '@ms/domain';

interface Store {
  version: 1;
  workspaces: Record<string, { projects: Project[]; revisions: ProjectRevisionRecord[]; offers: SupplierOffer[] }>;
}

/**
 * MODO DEMO: persistencia en un archivo JSON local (DATA_DIR/.data/modular-studio.json).
 * Sin concurrencia multi-proceso ni respaldos: no usar en producción (ver README, modo Prisma).
 */
export class FileRepository implements Repository {
  readonly kind = 'file-demo' as const;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private readonly file: string) {}

  private async load(): Promise<Store> {
    try {
      return JSON.parse(await readFile(this.file, 'utf8')) as Store;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, workspaces: {} };
      throw e;
    }
  }

  private async save(s: Store) {
    await mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(s, null, 1), 'utf8');
    await rename(tmp, this.file);
  }

  /** Serializa lecturas-modificaciones para evitar escrituras perdidas dentro del proceso. */
  private tx<T>(fn: (s: Store) => T | Promise<T>, write: boolean): Promise<T> {
    const run = this.queue.then(async () => {
      const s = await this.load();
      const r = await fn(s);
      if (write) await this.save(s);
      return r;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  private ws(s: Store, id: string) {
    if (!s.workspaces[id]) s.workspaces[id] = seedWorkspace();
    return s.workspaces[id];
  }

  listProjects(workspaceId: string): Promise<ProjectSummary[]> {
    return this.tx((s) => {
      const w = this.ws(s, workspaceId);
      return [...w.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((p) => ({
        id: p.id, name: p.name, customer: p.customer, updatedAt: p.updatedAt, moduleCount: p.modules.length,
        revisionCount: w.revisions.filter((r) => r.projectId === p.id).length,
      }));
    }, true);
  }

  getProject(workspaceId: string, id: string) {
    return this.tx((s) => {
      const p = this.ws(s, workspaceId).projects.find((x) => x.id === id);
      return p ? parseProject(p) : null;
    }, true);
  }

  createProject(workspaceId: string, project: Project) {
    return this.tx((s) => {
      const w = this.ws(s, workspaceId);
      if (w.projects.some((p) => p.id === project.id)) throw new ConcurrencyError(`Ya existe el proyecto ${project.id}`);
      w.projects.push(project);
      return project;
    }, true);
  }

  updateProject(workspaceId: string, project: Project, expectedUpdatedAt?: string) {
    return this.tx((s) => {
      const w = this.ws(s, workspaceId);
      const i = w.projects.findIndex((p) => p.id === project.id);
      if (i < 0) throw new NotFoundError(`Proyecto ${project.id} no encontrado`);
      if (expectedUpdatedAt && w.projects[i]!.updatedAt !== expectedUpdatedAt) throw new ConcurrencyError('El proyecto cambió desde que se abrió; recargue antes de guardar.');
      w.projects[i] = project;
      return project;
    }, true);
  }

  deleteProject(workspaceId: string, id: string) {
    return this.tx((s) => {
      const w = this.ws(s, workspaceId);
      w.projects = w.projects.filter((p) => p.id !== id);
      w.revisions = w.revisions.filter((r) => r.projectId !== id);
    }, true);
  }

  listRevisions(workspaceId: string, projectId: string) {
    return this.tx((s) => this.ws(s, workspaceId).revisions.filter((r) => r.projectId === projectId).sort((a, b) => b.number - a.number).map(({ snapshot: _s, ...r }) => r), true);
  }

  getRevision(workspaceId: string, projectId: string, revisionId: string) {
    return this.tx((s) => this.ws(s, workspaceId).revisions.find((r) => r.projectId === projectId && r.id === revisionId) ?? null, true);
  }

  createRevision(workspaceId: string, rec: Omit<ProjectRevisionRecord, 'id' | 'number'>) {
    return this.tx((s) => {
      const w = this.ws(s, workspaceId);
      if (!w.projects.some((p) => p.id === rec.projectId)) throw new NotFoundError(`Proyecto ${rec.projectId} no encontrado`);
      const number = Math.max(0, ...w.revisions.filter((r) => r.projectId === rec.projectId).map((r) => r.number)) + 1;
      const full: ProjectRevisionRecord = { ...rec, id: `${rec.projectId}-r${number}`, number };
      w.revisions.push(full);
      return full;
    }, true);
  }

  listOffers(workspaceId: string) {
    return this.tx((s) => this.ws(s, workspaceId).offers, true);
  }

  addOffers(workspaceId: string, offers: SupplierOffer[]) {
    return this.tx((s) => {
      const w = this.ws(s, workspaceId);
      const keys = new Set(w.offers.map(offerDedupKey));
      const ids = new Set(w.offers.map((o) => o.id));
      let n = 0;
      for (const o of offers) {
        if (keys.has(offerDedupKey(o)) || ids.has(o.id)) continue;
        w.offers.push(o);
        keys.add(offerDedupKey(o));
        ids.add(o.id);
        n++;
      }
      return n;
    }, true);
  }
}

function seedWorkspace(): Store['workspaces'][string] {
  const now = new Date().toISOString();
  const demo = createProject({ id: 'demo-cocina-closet', name: 'Demo: cocina + clóset + escritorio', familyId: 'kitchen_base', customer: 'Cliente demo', site: 'Obra demo', now }, DEFAULT_CATALOG);
  demo.modules.push({ ...createModule('kitchen_base', DEFAULT_CATALOG, 'M02', 'Gabinete cajonero'), widthMm: 600, front: 'drawers', drawerCount: 3, shelvesPerBay: 0, slideProductId: 'slide-generic-telescopic' });
  demo.modules.push(createModule('wardrobe', DEFAULT_CATALOG, 'M03'));
  demo.modules.push(createModule('desk', DEFAULT_CATALOG, 'M04'));
  return { projects: [demo], revisions: [], offers: DEMO_OFFERS.map((o) => ({ ...o })) };
}
