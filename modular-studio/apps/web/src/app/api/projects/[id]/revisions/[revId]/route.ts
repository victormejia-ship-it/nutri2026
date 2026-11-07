import { NotFoundError } from '@ms/domain';
import { getSession } from '@/server/auth';
import { handle, json } from '@/server/http';
import { getRepository } from '@/server/repo';

export const dynamic = 'force-dynamic';
type Ctx = { params: Promise<{ id: string; revId: string }> };

export const GET = handle(async (req: Request, ctx: Ctx) => {
  const s = getSession(req);
  const { id, revId } = await ctx.params;
  const rev = await (await getRepository()).getRevision(s.workspaceId, id, revId);
  if (!rev) throw new NotFoundError('Revisión no encontrada');
  return json({ revision: rev });
});
