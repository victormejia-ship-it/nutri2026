import type { Project, QuoteCompleteness, ReleaseStatus, SupplierOffer } from './types';

/**
 * Contrato de persistencia. Implementaciones: archivo JSON (modo demo, apps/web) y Prisma/PostgreSQL (packages/db).
 * Todas las operaciones se acotan a un workspace: el servidor nunca confía en el workspace enviado por el cliente.
 */
export interface ProjectSummary {
  id: string;
  name: string;
  customer: string;
  updatedAt: string;
  moduleCount: number;
  revisionCount: number;
}

export interface ProjectRevisionRecord {
  id: string;
  projectId: string;
  number: number;
  createdAt: string;
  note: string;
  author: string;
  schemaVersion: string;
  calcVersion: string;
  releaseStatus: ReleaseStatus;
  quoteCompleteness: QuoteCompleteness;
  snapshot: Project;
}

export class ConcurrencyError extends Error {}
export class NotFoundError extends Error {}

export interface Repository {
  readonly kind: 'file-demo' | 'prisma';
  listProjects(workspaceId: string): Promise<ProjectSummary[]>;
  getProject(workspaceId: string, id: string): Promise<Project | null>;
  createProject(workspaceId: string, project: Project): Promise<Project>;
  /** Si expectedUpdatedAt no coincide con el guardado, lanza ConcurrencyError. */
  updateProject(workspaceId: string, project: Project, expectedUpdatedAt?: string): Promise<Project>;
  deleteProject(workspaceId: string, id: string): Promise<void>;
  listRevisions(workspaceId: string, projectId: string): Promise<Omit<ProjectRevisionRecord, 'snapshot'>[]>;
  getRevision(workspaceId: string, projectId: string, revisionId: string): Promise<ProjectRevisionRecord | null>;
  createRevision(workspaceId: string, rec: Omit<ProjectRevisionRecord, 'id' | 'number'>): Promise<ProjectRevisionRecord>;
  listOffers(workspaceId: string): Promise<SupplierOffer[]>;
  addOffers(workspaceId: string, offers: SupplierOffer[]): Promise<number>;
}
