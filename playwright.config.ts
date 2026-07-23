import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { defineConfig } from '@playwright/test'

const chromePaths = [
  '/Applications/Google Chrome.app',
  `${process.env.HOME ?? ''}/Applications/Google Chrome.app`,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
]

if (!chromePaths.some((path) => path !== '' && existsSync(path))) {
  throw new Error('System Google Chrome is required; Folio does not download a browser fallback.')
}

process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'

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
