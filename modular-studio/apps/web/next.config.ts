import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ms/domain', '@ms/geometry', '@ms/cut-optimizer', '@ms/export', '@ms/db'],
  serverExternalPackages: ['@prisma/client'],
  poweredByHeader: false,
  // El lint se ejecuta desde la raíz del monorepo (npm run lint).
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    }];
  },
};

export default config;
