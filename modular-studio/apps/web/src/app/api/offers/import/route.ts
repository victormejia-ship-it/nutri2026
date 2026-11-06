import { SUPPLIERS, importOffersCsv } from '@ms/domain';
import { getSession, requireWrite } from '@/server/auth';
import { BadRequest, handle, json } from '@/server/http';
import { getRepository } from '@/server/repo';

/** Importa ofertas desde CSV (text/csv). De-duplica y conserva histórico. */
export const POST = handle(async (req: Request) => {
  const s = getSession(req);
  requireWrite(s);
  const text = await req.text();
  if (!text.trim()) throw new BadRequest('CSV vacío');
  if (text.length > 1_000_000) throw new BadRequest('CSV demasiado grande (máx. 1 MB)');
  const repo = await getRepository();
  const existing = await repo.listOffers(s.workspaceId);
  const res = importOffersCsv(text, existing, `csv-${Date.now().toString(36)}`, SUPPLIERS.map((x) => x.id));
  const added = res.offers.length ? await repo.addOffers(s.workspaceId, res.offers) : 0;
  return json({ added, duplicates: res.duplicates + (res.offers.length - added), errors: res.errors });
});
