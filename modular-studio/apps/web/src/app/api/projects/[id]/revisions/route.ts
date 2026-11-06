import { CALC_VERSION } from '@ms/domain';
import { getSession, requireWrite } from '@/server/auth';
import { handle, json, readJson } from '@/server/http';
import { getRepository } from '@/server/repo';
import { loadPlan } from '@/server/service';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const s = getSession(req);
  const { id } = await ctx.params;
  return json({ revisions: await (await getRepository()).listRevisions(s.workspaceId, id) });
});

/** Congela el proyecto GUARDADO como revisión, con estado de liberación y de cotización calculados en servidor. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const s = getSession(req);
  requireWrite(s);
  const { id } = await ctx.params;
  const body = (await readJson(req)) as { note?: string; author?: string };
  const { project, plan, generatedAt } = await loadPlan(s, id);
  const rev = await (await getRepository()).createRevision(s.workspaceId, {
    projectId: id, createdAt: generatedAt, note: String(body.note ?? '').slice(0, 500), author: String(body.author ?? s.userId).slice(0, 120),
    schemaVersion: project.schemaVersion, calcVersion: CALC_VERSION, releaseStatus: plan.calc.releaseStatus, quoteCompleteness: plan.quote.completeness, snapshot: project,
  });
  const { snapshot: _s, ...meta } = rev;
  return json({ revision: meta }, 201);
});
