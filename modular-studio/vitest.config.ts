import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@ms/domain': r('./packages/domain/src/index.ts'),
      '@ms/geometry': r('./packages/geometry/src/index.ts'),
      '@ms/cut-optimizer': r('./packages/cut-optimizer/src/index.ts'),
      '@ms/export': r('./packages/export/src/index.ts'),
      '@ms/db': r('./packages/db/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
