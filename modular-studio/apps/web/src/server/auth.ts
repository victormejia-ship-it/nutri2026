import 'server-only';
import { timingSafeEqual } from 'node:crypto';

export type Role = 'ADMIN' | 'DESIGNER' | 'CARPENTER' | 'BUYER' | 'VIEWER';
export interface Session { userId: string; workspaceId: string; role: Role; mode: 'demo' | 'token' }

export class AuthError extends Error {
  constructor(readonly status: 401 | 403, message: string) { super(message); }
}

const WRITE_ROLES: Role[] = ['ADMIN', 'DESIGNER', 'CARPENTER', 'BUYER'];

/**
 * Sesión del servidor. El workspace SIEMPRE se resuelve aquí, nunca desde el cuerpo de la petición.
 *  - AUTH_MODE=demo (por defecto): un único workspace local (DEMO_WORKSPACE_ID) con rol ADMIN.
 *  - AUTH_MODE=token: Authorization: Bearer <token>; API_TOKENS="token:workspace:ROL,..."
 * Integrar un proveedor de identidad (OIDC/Auth.js) está documentado como pendiente.
 */
export function getSession(req: Request): Session {
  const mode = process.env.AUTH_MODE === 'token' ? 'token' : 'demo';
  if (mode === 'demo') return { userId: 'demo', workspaceId: process.env.DEMO_WORKSPACE_ID ?? 'demo', role: 'ADMIN', mode };
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new AuthError(401, 'Falta token de acceso');
  for (const entry of (process.env.API_TOKENS ?? '').split(',')) {
    const [t, ws, role] = entry.split(':');
    if (!t || !ws || !role) continue;
    const a = Buffer.from(t), b = Buffer.from(token);
    if (a.length === b.length && timingSafeEqual(a, b)) return { userId: `token:${ws}`, workspaceId: ws, role: role as Role, mode };
  }
  throw new AuthError(401, 'Token inválido');
}

export function requireWrite(s: Session): void {
  if (!WRITE_ROLES.includes(s.role)) throw new AuthError(403, 'El rol no permite modificar datos');
}
