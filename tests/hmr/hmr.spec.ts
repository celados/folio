import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { expect, test } from '@playwright/test'

const sourcePath = resolve('examples/world-development/src/components/resource-file-preview.tsrx')
const initialText = 'Typed browser-side file readers'
const updatedText = 'Typed browser-side file readers (HMR)'

test('both Host dev servers accept a shared TSRX update without losing component state', async ({
  context,
}) => {
  const source = await readFile(sourcePath, 'utf8')
  if (!source.includes(initialText)) {
    throw new Error(`HMR sentinel source does not contain ${JSON.stringify(initialText)}`)
  }

  const pages = await Promise.all([context.newPage(), context.newPage()])
  const browserErrors: string[] = []
  for (const page of pages) {
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const source = message.location().url
        browserErrors.push(`${page.url()}: ${message.text()}${source ? ` (${source})` : ''}`)
      }
    })
    page.on('pageerror', (error) => browserErrors.push(`${page.url()}: ${error.message}`))
    page.on('response', (response) => {
      if (response.status() >= 400) {
        browserErrors.push(`${response.status()} ${response.url()}`)
      }
    })
  }

  try {
    await Promise.all([
      pages[0]!.goto('http://127.0.0.1:43175/'),
      pages[1]!.goto('http://127.0.0.1:43176/'),
    ])

    for (const page of pages) {
      await expect(page.getByRole('heading', { level: 2, name: initialText })).toBeVisible()
      await page.getByLabel('Report year').evaluate((element) => {
        const input = element as HTMLInputElement
        input.value = '1900'
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await expect(page.locator('.year-display strong')).toHaveText('1900')
    }

    await writeFile(sourcePath, source.replace(initialText, updatedText))

    for (const page of pages) {
      await expect(page.getByRole('heading', { level: 2, name: updatedText })).toBeVisible()
      await expect(page.locator('.year-display strong')).toHaveText('1900')
    }
    expect(browserErrors).toEqual([])
  } finally {
    await writeFile(sourcePath, source)
    await Promise.all(pages.map((page) => page.close()))
  }
})
