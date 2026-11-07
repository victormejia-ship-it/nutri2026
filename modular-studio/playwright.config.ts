import { defineConfig, devices } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const DATA_DIR = path.join(os.tmpdir(), `modular-studio-e2e-${Date.now()}`);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, acceptDownloads: true, trace: 'off', ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
  webServer: {
    // Requiere `npm run build` previo (o lo ejecuta si no existe la compilación).
    command: `(test -d apps/web/.next || npm run build -w @ms/web) && npx next start apps/web -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: { DATA_DIR, DATA_BACKEND: 'file', AUTH_MODE: 'demo', NEXT_TELEMETRY_DISABLED: '1' },
  },
});
