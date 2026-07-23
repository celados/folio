import { resolve } from 'node:path'

import { defineConfig } from '@playwright/test'

import { requireSystemChrome } from './tests/browser/system-chrome.ts'

requireSystemChrome()

export default defineConfig({
  testDir: 'tests/hmr',
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: 'line',
  use: {
    channel: 'chrome',
    headless: true,
  },
  webServer: [
    {
      // Exercise the same package-pinned Vite+ command that developers run for this Host.
      command: 'bun run dev -- --host 127.0.0.1 --port 43175 --strictPort',
      cwd: resolve('examples/tanstack-start'),
      port: 43175,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // Astro auto-backgrounds under agent environments; Playwright must own the foreground process.
      command: 'ASTRO_DEV_BACKGROUND=0 bunx astro dev --host 127.0.0.1 --port 43176',
      cwd: resolve('examples/astro'),
      port: 43176,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
