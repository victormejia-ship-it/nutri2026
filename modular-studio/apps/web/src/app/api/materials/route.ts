import { DEFAULT_CATALOG } from '@ms/domain';
import { handle, json } from '@/server/http';

export const GET = handle(async () => {
  const { materials, finishes, edgeBands, steelProfiles, hardware, machiningPatterns } = DEFAULT_CATALOG;
  return json({ materials, finishes, edgeBands, steelProfiles, hardware, machiningPatterns, note: 'Los precios no forman parte del catálogo: ver /api/offers.' });
});
