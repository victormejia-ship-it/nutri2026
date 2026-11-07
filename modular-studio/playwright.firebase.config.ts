import { defineConfig, devices } from '@playwright/test';

/**
 * E2E del sitio estático (Firebase Hosting) contra los emuladores de Firebase.
 * Requiere: `npm run build:firebase:emulator` y `npm run firebase:emulators` en otra terminal.
 */
export default defineConfig({
  testDir: 'tests/e2e-firebase',
  timeout: 90_000,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: process.env.FIREBASE_E2E_URL ?? 'http://127.0.0.1:5000', acceptDownloads: true, trace: 'off', ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
});
