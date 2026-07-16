import { defineConfig, devices } from '@playwright/test';

/** E2E: гоняем против локального dev-сервера Vite (проксирует API на :3001). */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'mobile-320', use: { viewport: { width: 320, height: 720 } } },
    { name: 'mobile-425', use: { viewport: { width: 425, height: 800 } } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
});
