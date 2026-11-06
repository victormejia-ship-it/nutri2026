import 'server-only';
import { ConcurrencyError, NotFoundError, ProjectValidationError } from '@ms/domain';
import { AuthError } from './auth';

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export class BadRequest extends Error {}

/** Envuelve un handler con manejo uniforme de errores (sin filtrar trazas al cliente). */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof AuthError) return json({ error: e.message }, e.status);
      if (e instanceof ProjectValidationError) return json({ error: 'Datos inválidos', issues: e.issues }, 422);
      if (e instanceof BadRequest) return json({ error: e.message }, 400);
      if (e instanceof NotFoundError) return json({ error: e.message }, 404);
      if (e instanceof ConcurrencyError) return json({ error: e.message }, 409);
      console.error('[api] error no controlado', e);
      return json({ error: 'Error interno del servidor' }, 500);
    }
  };
}

export async function readJson(req: Request, maxBytes = 2_000_000): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new BadRequest('Cuerpo demasiado grande');
  try { return JSON.parse(text); } catch { throw new BadRequest('JSON inválido'); }
}

export const todayISO = () => new Date().toISOString().slice(0, 10);
export const nowISO = () => new Date().toISOString();
