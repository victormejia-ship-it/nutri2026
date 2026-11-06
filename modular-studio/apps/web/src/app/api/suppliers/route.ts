import { SUPPLIERS } from '@ms/domain';
import { handle, json } from '@/server/http';

export const GET = handle(async () => json({ suppliers: SUPPLIERS, disclaimer: 'Sin afiliación, certificación ni colaboración comercial con los proveedores listados.' }));
