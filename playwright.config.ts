import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  // Offline tests require network control — run sequentially
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: 'http://localhost:4173',
    // Every test starts with a provisioned, authenticated session
    storageState: 'tests/.auth/user.json',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Build the app first so the service worker + dist assets are fresh,
    // then serve via `vite preview` (the only mode where sw.js is active).
    command: 'npm run build && npx vite preview --port 4173',
    url: 'http://localhost:4173',
    // Re-use the server across local runs to avoid repeated builds
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
