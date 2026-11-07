import { DEFAULT_CATALOG, parseProject, planProject } from '@ms/domain';
import { getSession } from '@/server/auth';
import { handle, json, nowISO, readJson, todayISO } from '@/server/http';
import { getRepository } from '@/server/repo';

/** Cálculo sin persistir (validación de un proyecto arbitrario con las ofertas del workspace). */
export const POST = handle(async (req: Request) => {
  const s = getSession(req);
  const body = (await readJson(req)) as { project?: unknown };
  const project = parseProject(body.project);
  const offers = await (await getRepository()).listOffers(s.workspaceId);
  return json(planProject(project, DEFAULT_CATALOG, offers, todayISO(), nowISO()));
});
