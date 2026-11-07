import { NoopRenderProvider, type RenderKind } from '@ms/domain';
import { getSession } from '@/server/auth';
import { handle, json, readJson } from '@/server/http';

/** Render fotorrealista opcional: sin proveedor configurado responde "no_configurado". */
export const POST = handle(async (req: Request) => {
  getSession(req);
  const body = (await readJson(req)) as { projectId?: string; moduleId?: string; kind?: RenderKind };
  return json(await NoopRenderProvider.render({ projectId: String(body.projectId ?? ''), moduleId: String(body.moduleId ?? ''), kind: body.kind === 'render_geometrico_fiel' ? 'render_geometrico_fiel' : 'inspiracion_visual' }));
});
