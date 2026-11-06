import 'server-only';
import path from 'node:path';
import type { Repository } from '@ms/domain';
import { FileRepository } from './file-repo';

let instance: Promise<Repository> | null = null;

/**
 * DATA_BACKEND=prisma (con DATABASE_URL) => PostgreSQL vía Prisma.
 * Cualquier otro valor => modo demo con archivo local, claramente identificado en la UI.
 */
export function getRepository(): Promise<Repository> {
  if (!instance) {
    instance = (async () => {
      if (process.env.DATA_BACKEND === 'prisma') {
        if (!process.env.DATABASE_URL) throw new Error('DATA_BACKEND=prisma requiere DATABASE_URL');
        const { PrismaRepository } = await import('@ms/db');
        return new PrismaRepository();
      }
      const dir = process.env.DATA_DIR ?? path.join(process.cwd(), '.data');
      return new FileRepository(path.join(dir, 'modular-studio.json'));
    })();
  }
  return instance;
}
