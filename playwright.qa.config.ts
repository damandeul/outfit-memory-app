import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'qa.spec.ts',
  fullyParallel: false,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: 'artifacts/qa/playwright-results.json' }],
    ['html', { outputFolder: 'artifacts/qa/playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{
    name: 'qa-chromium',
    use: {
      ...devices['Desktop Chrome'],
      browserName: 'chromium',
      viewport: { width: 390, height: 844 },
    },
  }],
  webServer: {
    command: 'npm exec vite preview -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
  },
});
