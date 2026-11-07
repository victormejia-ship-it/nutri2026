import type { NextConfig } from 'next';

/**
 * Dos destinos de compilación:
 *  - Servidor (por defecto): Next.js con API (/api/*), modo demo con archivo o PostgreSQL.
 *  - Firebase Hosting (BUILD_TARGET=firebase): sitio estático en `out/`, datos en Firestore y sesión con Firebase Auth.
 *    Las rutas /api (archivos route.ts) se excluyen de la compilación con `pageExtensions`.
 */
const firebase = process.env.BUILD_TARGET === 'firebase';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
];

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ms/domain', '@ms/geometry', '@ms/cut-optimizer', '@ms/export', '@ms/db'],
  poweredByHeader: false,
  // El lint se ejecuta desde la raíz del monorepo (npm run lint).
  eslint: { ignoreDuringBuilds: true },
  env: { NEXT_PUBLIC_DATA_BACKEND: firebase ? 'firebase' : 'http' },
  ...(firebase
    ? { output: 'export' as const, trailingSlash: true, pageExtensions: ['tsx', 'jsx', 'js'], images: { unoptimized: true } }
    : {
        serverExternalPackages: ['@prisma/client'],
        async headers() { return [{ source: '/(.*)', headers: securityHeaders }]; },
      }),
};

export default config;
