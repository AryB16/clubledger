import { defineConfig, devices } from '@playwright/test'

// Run against production by default: BASE_URL=https://… npx playwright test
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 25_000 },
  retries: 1,
  reporter: [['list']],
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:4173',
    viewport: { width: 375, height: 812 },
    trace: 'off',
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: false } }],
})
