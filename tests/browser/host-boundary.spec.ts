import { expect, test, type Page } from '@playwright/test'

const hosts = [
  { name: 'TanStack Start', url: 'http://127.0.0.1:43173/' },
  { name: 'Astro', url: 'http://127.0.0.1:43174/' },
] as const

for (const host of hosts) {
  test(`${host.name} mounts the shared component without remote runtime dependencies`, async ({
    context,
    page,
  }) => {
    const externalRequests: string[] = []
    const browserErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text())
    })
    page.on('pageerror', (error) => browserErrors.push(error.message))
    await context.route('**/*', async (route) => {
      const url = new URL(route.request().url())
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
        await route.continue()
        return
      }
      externalRequests.push(url.href)
      await route.abort()
    })

    await page.goto(host.url)
    await assertAtlas(page)

    expect(externalRequests).toEqual([])
    expect(browserErrors).toEqual([])
  })
}

test('the shared component preserves interaction, style, and lifecycle contracts', async ({
  page,
}) => {
  const browserErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })
  page.on('pageerror', (error) => browserErrors.push(error.message))

  await page.goto('http://127.0.0.1:43173/')
  await assertAtlas(page)

  const report = page.locator('.report')
  await expect(report).toHaveCSS('color', 'rgb(23, 34, 30)')
  expect(await report.evaluate((element) => element.getBoundingClientRect().width)).toBeGreaterThan(
    900,
  )

  const year = page.getByLabel('Report year')
  await year.evaluate((element) => {
    const input = element as HTMLInputElement
    input.value = '1900'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(page.locator('.year-display strong')).toHaveText('1900')

  await page.locator('.filters select').selectOption('Europe & Central Asia')
  await page.locator('.filters input[type="search"]').fill('France')
  await expect(page.locator('.summary article').first()).toContainText('1 countries')

  await page.getByRole('button', { name: 'Resource provenance' }).click()
  await expect(page.locator('.resource-inspectors pre').last()).toContainText('duckdb')

  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export visible CSV' }).click()
  expect((await download).suggestedFilename()).toBe('world-development-1900.csv')

  await page.reload()
  await assertAtlas(page)
  await expect(page.locator('.report')).toHaveCount(1)
  expect(browserErrors).toEqual([])
})

async function assertAtlas(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { level: 1, name: 'World development atlas' }),
  ).toBeVisible()
  await expect(page.locator('.report svg')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Export visible CSV' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resource provenance' })).toBeVisible()
}
