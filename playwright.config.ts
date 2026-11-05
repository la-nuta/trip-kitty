import { defineConfig, devices } from '@playwright/test';

const inCi = Boolean(process.env['CI']);

export default defineConfig({
  testDir: './e2e',
  forbidOnly: inCi,
  reporter: inCi ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile-360',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 } },
    },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: !inCi,
    timeout: 120_000,
  },
});
