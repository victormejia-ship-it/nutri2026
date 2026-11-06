import { NotFoundError, parseProject } from '@ms/domain';
import { getSession, requireWrite } from '@/server/auth';
import { BadRequest, handle, json, nowISO, readJson } from '@/server/http';
import { getRepository } from '@/server/repo';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const s = getSession(req);
  const { id } = await ctx.params;
  const p = await (await getRepository()).getProject(s.workspaceId, id);
  if (!p) throw new NotFoundError('Proyecto no encontrado');
  return json({ project: p });
});

/** Guarda el borrador completo. Control de concurrencia optimista con expectedUpdatedAt. */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const s = getSession(req);
  requireWrite(s);
  const { id } = await ctx.params;
  const body = (await readJson(req)) as { project?: unknown; expectedUpdatedAt?: string };
  const incoming = parseProject(body.project);
  if (incoming.id !== id) throw new BadRequest('El ID del cuerpo no coincide con la URL');
  const repo = await getRepository();
  const current = await repo.getProject(s.workspaceId, id);
  if (!current) throw new NotFoundError('Proyecto no encontrado');
  // Campos controlados por el servidor
  const saved = await repo.updateProject(s.workspaceId, { ...incoming, createdAt: current.createdAt, updatedAt: nowISO() }, body.expectedUpdatedAt);
  return json({ project: saved });
});

export const DELETE = handle(async (req: Request, ctx: Ctx) => {
  const s = getSession(req);
  requireWrite(s);
  const { id } = await ctx.params;
  await (await getRepository()).deleteProject(s.workspaceId, id);
  return new Response(null, { status: 204 });
});
