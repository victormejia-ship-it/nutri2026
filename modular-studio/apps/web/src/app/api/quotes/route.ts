import { getSession } from '@/server/auth';
import { BadRequest, handle, json, readJson } from '@/server/http';
import { loadPlan } from '@/server/service';

/** Cotización recalculada en servidor desde el proyecto guardado y las ofertas registradas. */
export const POST = handle(async (req: Request) => {
  const s = getSession(req);
  const body = (await readJson(req)) as { projectId?: string; revisionId?: string };
  if (!body.projectId) throw new BadRequest('projectId requerido');
  const { plan } = await loadPlan(s, body.projectId, body.revisionId);
  return json({ quote: plan.quote, releaseStatus: plan.calc.releaseStatus });
});
