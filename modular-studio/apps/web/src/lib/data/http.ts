'use client';
import type { Project, ProjectRevisionRecord, ProjectSummary, SupplierOffer } from '@ms/domain';
import { api, downloadExport } from '../api';
import type { DataClient, RevisionMeta } from './types';

export const httpClient: DataClient = {
  kind: 'http',
  async backendLabel() {
    const h = await api<{ backend: string }>('/api/health');
    return h.backend === 'prisma' ? { label: 'PostgreSQL', tone: 'ok' } : { label: 'MODO DEMO · persistencia local', tone: 'warn' };
  },
  async listProjects() { return (await api<{ projects: ProjectSummary[] }>('/api/projects')).projects; },
  async getProject(id) {
    try { return (await api<{ project: Project }>(`/api/projects/${encodeURIComponent(id)}`)).project; }
    catch (e) { if ((e as { status?: number }).status === 404) return null; throw e; }
  },
  async createProject(input) { return (await api<{ project: Project }>('/api/projects', { method: 'POST', json: input })).project; },
  async duplicateProject(id) { return (await api<{ project: Project }>('/api/projects', { method: 'POST', json: { sourceId: id } })).project; },
  async importProject(raw) { return api<{ project: Project; notes: string[] }>('/api/projects', { method: 'POST', json: { import: raw } }); },
  async saveProject(project, expectedUpdatedAt) {
    return (await api<{ project: Project }>(`/api/projects/${encodeURIComponent(project.id)}`, { method: 'PATCH', json: { project, expectedUpdatedAt } })).project;
  },
  async deleteProject(id) { await api(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async listRevisions(projectId) { return (await api<{ revisions: RevisionMeta[] }>(`/api/projects/${encodeURIComponent(projectId)}/revisions`)).revisions; },
  async getRevision(projectId, revisionId) {
    return (await api<{ revision: ProjectRevisionRecord }>(`/api/projects/${encodeURIComponent(projectId)}/revisions/${encodeURIComponent(revisionId)}`)).revision;
  },
  async createRevision(projectId, note) { return (await api<{ revision: RevisionMeta }>(`/api/projects/${encodeURIComponent(projectId)}/revisions`, { method: 'POST', json: { note } })).revision; },
  async listOffers() { return (await api<{ offers: SupplierOffer[] }>('/api/offers')).offers; },
  async addOffer(offer) { return (await api<{ offer: SupplierOffer }>('/api/offers', { method: 'POST', json: offer })).offer; },
  async importOffersCsv(csv) { return api('/api/offers/import', { method: 'POST', body: csv, headers: { 'Content-Type': 'text/csv' } }); },
  async exportProject(projectId, format, opts) { return downloadExport(format, { projectId, ...opts }); },
};
