import { SUPPLIERS, parseOffer } from '@ms/domain';
import { getSession, requireWrite } from '@/server/auth';
import { BadRequest, handle, json, nowISO, readJson } from '@/server/http';
import { getRepository } from '@/server/repo';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req: Request) => {
  const s = getSession(req);
  return json({ offers: await (await getRepository()).listOffers(s.workspaceId) });
});

/** Captura manual de una oferta/cotización (con fuente, fecha e IVA explícitos). */
export const POST = handle(async (req: Request) => {
  const s = getSession(req);
  requireWrite(s);
  const body = (await readJson(req)) as Record<string, unknown>;
  if (!SUPPLIERS.some((x) => x.id === body.supplierId)) throw new BadRequest('Proveedor desconocido');
  const offer = parseOffer({ ...body, id: `man-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, currency: 'MXN', capturedBy: body.capturedBy || s.userId, notes: body.notes ?? `Captura ${nowISO()}` });
  const added = await (await getRepository()).addOffers(s.workspaceId, [offer]);
  if (!added) return json({ error: 'Oferta duplicada (proveedor + SKU + presentación + fecha)' }, 409);
  return json({ offer }, 201);
});
