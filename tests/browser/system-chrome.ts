import { existsSync } from 'node:fs'

const chromePaths = [
  '/Applications/Google Chrome.app',
  `${process.env.HOME ?? ''}/Applications/Google Chrome.app`,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
]

export function requireSystemChrome(): void {
  if (!chromePaths.some((path) => path !== '' && existsSync(path))) {
    throw new Error('System Google Chrome is required; Folio does not download a browser fallback.')
  }

  process.env.PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = '1'
}
