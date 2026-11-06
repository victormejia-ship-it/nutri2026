import { DEFAULT_CATALOG, createProject, migrateProject, parseProject, type Project } from '@ms/domain';
import { getSession, requireWrite } from '@/server/auth';
import { BadRequest, handle, json, nowISO, readJson } from '@/server/http';
import { getRepository } from '@/server/repo';

export const dynamic = 'force-dynamic';

const newId = () => `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export const GET = handle(async (req: Request) => {
  const s = getSession(req);
  const repo = await getRepository();
  return json({ projects: await repo.listProjects(s.workspaceId), backend: repo.kind });
});

/**
 * Crear proyecto. Cuerpo:
 *  { name, familyId, customer?, site? }  — desde plantilla
 *  { sourceId }                          — duplicar
 *  { import: <json> }                    — importar (con migración explícita si es esquema anterior)
 */
export const POST = handle(async (req: Request) => {
  const s = getSession(req);
  requireWrite(s);
  const body = (await readJson(req)) as { name?: string; familyId?: string; customer?: string; site?: string; sourceId?: string; import?: unknown };
  const repo = await getRepository();
  const now = nowISO();
  let project: Project;
  let notes: string[] = [];
  if (body.sourceId) {
    const src = await repo.getProject(s.workspaceId, body.sourceId);
    if (!src) throw new BadRequest('Proyecto origen no encontrado');
    project = parseProject({ ...structuredClone(src), id: newId(), name: `${src.name} (copia)`, createdAt: now, updatedAt: now, approval: null, status: 'DRAFT_NOT_RELEASED_FOR_MANUFACTURING' });
  } else if (body.import !== undefined) {
    const raw = body.import as Record<string, unknown>;
    const inner = raw && typeof raw === 'object' && 'project' in raw && raw.format === 'modular-studio.project+calculation' ? raw.project : raw;
    const res = migrateProject(inner, DEFAULT_CATALOG, now);
    notes = res.notes;
    project = parseProject({ ...res.project, id: newId(), createdAt: now, updatedAt: now });
  } else {
    if (!body.name?.trim()) throw new BadRequest('Nombre requerido');
    if (!DEFAULT_CATALOG.families.some((f) => f.id === body.familyId)) throw new BadRequest('Familia desconocida');
    project = createProject({ id: newId(), name: body.name.trim().slice(0, 160), familyId: body.familyId!, customer: body.customer?.slice(0, 160), site: body.site?.slice(0, 240), now }, DEFAULT_CATALOG);
  }
  await repo.createProject(s.workspaceId, project);
  return json({ project, notes }, 201);
});
