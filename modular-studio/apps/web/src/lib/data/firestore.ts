'use client';
import {
  collection, doc, getDoc, getDocs, orderBy, query, runTransaction, setDoc, writeBatch,
} from 'firebase/firestore';
import {
  CALC_VERSION, ConcurrencyError, DEFAULT_CATALOG, DEMO_OFFERS, SUPPLIERS, createProject, importOffersCsv, migrateProject, offerDedupKey,
  parseOffer, parseProject, planProject,
  type Project, type ProjectRevisionRecord, type ProjectSummary, type SupplierOffer,
} from '@ms/domain';
import { exportInBrowser } from './exports';
import { firebase } from './firebase-app';
import type { DataClient, RevisionMeta } from './types';

/*
 * Modelo en Firestore (un espacio por usuario autenticado):
 *   ms_users/{uid}/projects/{projectId}             { name, customer, updatedAt, moduleCount, revisionCount, data: JSON del Project }
 *   ms_users/{uid}/projects/{projectId}/revisions/{n}  { ...metadatos, snapshot: JSON del Project }
 *   ms_users/{uid}/offers/{offerId}                   { ...SupplierOffer, dedupKey }
 * El proyecto se guarda como texto JSON para conservar exactamente el documento versionado (schemaVersion).
 */

const uid = () => {
  const u = firebase().auth.currentUser;
  if (!u) throw new Error('Inicie sesión para continuar.');
  return u.uid;
};
const projects = () => collection(firebase().db, 'ms_users', uid(), 'projects');
const projectRef = (id: string) => doc(firebase().db, 'ms_users', uid(), 'projects', id);
const revisions = (pid: string) => collection(firebase().db, 'ms_users', uid(), 'projects', pid, 'revisions');
const offersCol = () => collection(firebase().db, 'ms_users', uid(), 'offers');
const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

function projectDoc(p: Project, revisionCount: number) {
  return { name: p.name, customer: p.customer, updatedAt: p.updatedAt, moduleCount: p.modules.length, revisionCount, schemaVersion: p.schemaVersion, data: JSON.stringify(p) };
}

async function ensureSeedOffers(): Promise<void> {
  // Primera vez: carga las ofertas demo del prototipo, marcadas ESTIMADO/PENDIENTE (simulación).
  const marker = doc(firebase().db, 'ms_users', uid());
  const snap = await getDoc(marker);
  if (snap.exists() && snap.data().seeded) return;
  const batch = writeBatch(firebase().db);
  for (const o of DEMO_OFFERS) batch.set(doc(offersCol(), o.id), { ...o, dedupKey: offerDedupKey(o) });
  batch.set(marker, { seeded: true, createdAt: new Date().toISOString() }, { merge: true });
  await batch.commit();
}

async function insertProject(p: Project): Promise<Project> {
  await setDoc(projectRef(p.id), projectDoc(p, 0));
  return p;
}

export const firestoreClient: DataClient = {
  kind: 'firebase',
  async backendLabel() { return { label: 'Firebase · datos de tu cuenta', tone: 'ok' }; },

  async listProjects(): Promise<ProjectSummary[]> {
    await ensureSeedOffers();
    const snap = await getDocs(query(projects(), orderBy('updatedAt', 'desc')));
    return snap.docs.map((d) => {
      const x = d.data();
      return { id: d.id, name: x.name, customer: x.customer ?? '', updatedAt: x.updatedAt, moduleCount: x.moduleCount ?? 0, revisionCount: x.revisionCount ?? 0 };
    });
  },

  async getProject(id) {
    const snap = await getDoc(projectRef(id));
    return snap.exists() ? parseProject(JSON.parse(snap.data().data as string)) : null;
  },

  async createProject(input) {
    if (!input.name.trim()) throw new Error('Nombre requerido');
    const now = new Date().toISOString();
    return insertProject(createProject({ id: newId('p'), name: input.name.trim().slice(0, 160), familyId: input.familyId, customer: input.customer?.slice(0, 160), site: input.site?.slice(0, 240), now }, DEFAULT_CATALOG));
  },

  async duplicateProject(id) {
    const src = await this.getProject(id);
    if (!src) throw new Error('Proyecto origen no encontrado');
    const now = new Date().toISOString();
    return insertProject(parseProject({ ...structuredClone(src), id: newId('p'), name: `${src.name} (copia)`, createdAt: now, updatedAt: now, approval: null, status: 'DRAFT_NOT_RELEASED_FOR_MANUFACTURING' }));
  },

  async importProject(raw) {
    const now = new Date().toISOString();
    const r = raw as Record<string, unknown>;
    const inner = r && typeof r === 'object' && r.format === 'modular-studio.project+calculation' ? r.project : raw;
    const res = migrateProject(inner, DEFAULT_CATALOG, now);
    const project = await insertProject(parseProject({ ...res.project, id: newId('p'), createdAt: now, updatedAt: now }));
    return { project, notes: res.notes };
  },

  async saveProject(project, expectedUpdatedAt) {
    const valid = parseProject(project);
    const ref = projectRef(valid.id);
    return runTransaction(firebase().db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Proyecto no encontrado');
      if (snap.data().updatedAt !== expectedUpdatedAt) throw new ConcurrencyError('El proyecto cambió desde que se abrió (otra pestaña o dispositivo); recargue antes de guardar.');
      const current = parseProject(JSON.parse(snap.data().data as string));
      const saved: Project = { ...valid, createdAt: current.createdAt, updatedAt: new Date().toISOString() };
      tx.set(ref, projectDoc(saved, snap.data().revisionCount ?? 0));
      return saved;
    });
  },

  async deleteProject(id) {
    const revs = await getDocs(revisions(id));
    const batch = writeBatch(firebase().db);
    revs.forEach((r) => batch.delete(r.ref));
    batch.delete(projectRef(id));
    await batch.commit();
  },

  async listRevisions(projectId) {
    const snap = await getDocs(query(revisions(projectId), orderBy('number', 'desc')));
    return snap.docs.map((d) => { const { snapshot: _s, ...meta } = d.data(); return { ...(meta as RevisionMeta), id: d.id }; });
  },

  async getRevision(projectId, revisionId) {
    const snap = await getDoc(doc(revisions(projectId), revisionId));
    if (!snap.exists()) return null;
    const x = snap.data();
    return { ...(x as Omit<ProjectRevisionRecord, 'snapshot'>), id: snap.id, snapshot: parseProject(JSON.parse(x.snapshot as string)) };
  },

  async createRevision(projectId, note) {
    const ref = projectRef(projectId);
    const offers = await this.listOffers();
    const author = firebase().auth.currentUser?.email ?? uid();
    return runTransaction(firebase().db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) throw new Error('Proyecto no encontrado');
      const project = parseProject(JSON.parse(snap.data().data as string));
      const now = new Date().toISOString();
      const plan = planProject(project, DEFAULT_CATALOG, offers, now.slice(0, 10), now);
      const number = (snap.data().revisionCount ?? 0) + 1;
      const id = `r${String(number).padStart(4, '0')}`;
      const meta: RevisionMeta = {
        id, projectId, number, createdAt: now, note: note.slice(0, 500), author, schemaVersion: project.schemaVersion, calcVersion: CALC_VERSION,
        releaseStatus: plan.calc.releaseStatus, quoteCompleteness: plan.quote.completeness,
      };
      tx.set(doc(revisions(projectId), id), { ...meta, snapshot: JSON.stringify(project) });
      tx.update(ref, { revisionCount: number });
      return meta;
    });
  },

  async listOffers() {
    const snap = await getDocs(offersCol());
    return snap.docs.map((d) => { const { dedupKey: _k, ...o } = d.data(); return parseOffer({ ...o, id: d.id }); });
  },

  async addOffer(input) {
    if (!SUPPLIERS.some((s) => s.id === input.supplierId)) throw new Error('Proveedor desconocido');
    const offer = parseOffer({ ...input, id: newId('man'), currency: 'MXN', capturedBy: input.capturedBy || firebase().auth.currentUser?.email || null });
    const existing = await this.listOffers();
    if (existing.some((o) => offerDedupKey(o) === offerDedupKey(offer))) throw new Error('Oferta duplicada (proveedor + SKU + presentación + fecha)');
    await setDoc(doc(offersCol(), offer.id), { ...offer, dedupKey: offerDedupKey(offer) });
    return offer;
  },

  async importOffersCsv(csv) {
    const existing = await this.listOffers();
    const res = importOffersCsv(csv, existing, newId('csv'), SUPPLIERS.map((s) => s.id));
    for (let i = 0; i < res.offers.length; i += 400) {
      const batch = writeBatch(firebase().db);
      for (const o of res.offers.slice(i, i + 400)) batch.set(doc(offersCol(), o.id), { ...o, dedupKey: offerDedupKey(o) });
      await batch.commit();
    }
    return { added: res.offers.length, duplicates: res.duplicates, errors: res.errors };
  },

  async exportProject(projectId, format, opts) {
    const project = opts.revisionId ? (await this.getRevision(projectId, opts.revisionId))?.snapshot : await this.getProject(projectId);
    if (!project) throw new Error('Proyecto o revisión no encontrado');
    return exportInBrowser(project, await this.listOffers(), format, opts);
  },
};

export type { SupplierOffer };
