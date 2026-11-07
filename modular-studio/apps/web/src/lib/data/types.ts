import type { Project, ProjectRevisionRecord, ProjectSummary, SupplierOffer } from '@ms/domain';

export type RevisionMeta = Omit<ProjectRevisionRecord, 'snapshot'>;
export type ExportFormat = 'json' | 'parts-csv' | 'quote-csv' | 'hardware-csv' | 'svg' | 'cut-svg' | 'mermaid' | 'pdf';
export interface ExportOptions { revisionId?: string | null; separator?: ',' | ';'; exploded?: boolean; view?: 'iso' | 'front' | 'side' | 'top'; sheet?: number }
export interface NewProjectInput { name: string; familyId: string; customer?: string; site?: string }
export interface OfferImportResult { added: number; duplicates: number; errors: { row: number; message: string }[] }

/**
 * Acceso a datos desde el navegador. Dos implementaciones:
 *  - http: API de Next.js (servidor con archivo demo o PostgreSQL).
 *  - firebase: Firestore + Firebase Auth (sitio estático en Firebase Hosting), datos por usuario.
 */
export interface DataClient {
  readonly kind: 'http' | 'firebase';
  /** Etiqueta de persistencia para la UI. */
  backendLabel(): Promise<{ label: string; tone: 'ok' | 'warn' }>;
  listProjects(): Promise<ProjectSummary[]>;
  getProject(id: string): Promise<Project | null>;
  createProject(input: NewProjectInput): Promise<Project>;
  duplicateProject(id: string): Promise<Project>;
  importProject(raw: unknown): Promise<{ project: Project; notes: string[] }>;
  /** Guarda con control optimista; devuelve el proyecto con updatedAt asignado. */
  saveProject(project: Project, expectedUpdatedAt: string): Promise<Project>;
  deleteProject(id: string): Promise<void>;
  listRevisions(projectId: string): Promise<RevisionMeta[]>;
  getRevision(projectId: string, revisionId: string): Promise<ProjectRevisionRecord | null>;
  createRevision(projectId: string, note: string): Promise<RevisionMeta>;
  listOffers(): Promise<SupplierOffer[]>;
  addOffer(offer: Omit<SupplierOffer, 'id' | 'currency'>): Promise<SupplierOffer>;
  importOffersCsv(csv: string): Promise<OfferImportResult>;
  /** Genera y descarga un archivo; devuelve el nombre del archivo. */
  exportProject(projectId: string, format: ExportFormat, opts: ExportOptions): Promise<string>;
}
