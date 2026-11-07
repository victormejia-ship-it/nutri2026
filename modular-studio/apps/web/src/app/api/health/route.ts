import { getRepository } from '@/server/repo';
import { handle, json } from '@/server/http';
import { CALC_VERSION, SCHEMA_VERSION } from '@ms/domain';

export const dynamic = 'force-dynamic';
export const GET = handle(async () => {
  const repo = await getRepository();
  return json({ ok: true, backend: repo.kind, calcVersion: CALC_VERSION, schemaVersion: SCHEMA_VERSION });
});
