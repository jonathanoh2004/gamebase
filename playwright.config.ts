import { defineConfig, devices } from '@playwright/test';

// End-to-end tests run against the local backend (embedded Postgres, dev
// sign-in, SSE realtime) on a production build, so run `pnpm build` first.
// E2E_BASE_URL points them at a server that is already running instead.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3100';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    // A preinstalled Chromium (e.g. in a sandbox) instead of Playwright's own.
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
      testIgnore: /phone\.spec\.ts/,
    },
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /phone\.spec\.ts/ },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'pnpm exec tsx scripts/local.ts serve',
        url: `${baseURL}/signin`,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
