import 'server-only';
import { DEFAULT_CATALOG, NotFoundError, planProject, type Project } from '@ms/domain';
import type { Session } from './auth';
import { nowISO, todayISO } from './http';
import { getRepository } from './repo';

/** Recalcula en servidor desde lo guardado: nunca se confía en costos enviados por el navegador. */
export async function loadPlan(s: Session, projectId: string, revisionId?: string | null) {
  const repo = await getRepository();
  let project: Project | null;
  if (revisionId) project = (await repo.getRevision(s.workspaceId, projectId, revisionId))?.snapshot ?? null;
  else project = await repo.getProject(s.workspaceId, projectId);
  if (!project) throw new NotFoundError('Proyecto o revisión no encontrado');
  const offers = await repo.listOffers(s.workspaceId);
  const generatedAt = nowISO();
  return { project, offers, generatedAt, plan: planProject(project, DEFAULT_CATALOG, offers, todayISO(), generatedAt) };
}
