import { defineConfig, devices } from '@playwright/test';

// Uses a locally installed Chrome when CHROME_PATH is set; otherwise Playwright's Chromium
// (install with `npx playwright install chromium`).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173',
    // Software WebGL so the 3D view renders in headless CI.
    launchOptions: {
      args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
      ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }, grepInvert: /@phone/ },
    { name: 'phone', use: { ...devices['Pixel 7'] }, grep: /@phone/ },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
