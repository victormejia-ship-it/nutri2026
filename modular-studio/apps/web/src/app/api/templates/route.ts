import { CATEGORY_LABELS, FAMILIES, FAMILY_STATUS_LABELS } from '@ms/domain';
import { handle, json } from '@/server/http';

export const GET = handle(async () => json({ families: FAMILIES, categories: CATEGORY_LABELS, statuses: FAMILY_STATUS_LABELS }));
