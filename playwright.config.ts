import { resolve } from 'node:path'

import { defineConfig } from '@playwright/test'

import { requireSystemChrome } from './tests/browser/system-chrome.ts'

requireSystemChrome()

export default defineConfig({
  testDir: 'tests/browser',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://127.0.0.1:43173',
    channel: 'chrome',
    headless: true,
    viewport: { height: 900, width: 1440 },
  },
  webServer: [
    {
      command: 'bun run preview:e2e',
      cwd: resolve('examples/tanstack-start'),
      port: 43173,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'bun run preview:e2e',
      cwd: resolve('examples/astro'),
      port: 43174,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
