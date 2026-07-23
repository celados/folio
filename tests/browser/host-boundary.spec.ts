import { expect, test, type Download, type Page } from '@playwright/test'

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

for (const host of hosts) {
  test(`${host.name} links Search, DataTable, Inspector, and Download to report state`, async ({
    page,
  }) => {
    const browserErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text())
    })
    page.on('pageerror', (error) => browserErrors.push(error.message))

    await page.goto(host.url)
    await assertAtlas(page)

    const report = page.locator('.report')
    await expect(report).toHaveCSS('color', 'rgb(23, 34, 30)')
    expect(
      await report.evaluate((element) => element.getBoundingClientRect().width),
    ).toBeGreaterThan(900)

    const year = page.getByLabel('Report year')
    await year.evaluate((element) => {
      const input = element as HTMLInputElement
      input.value = '1900'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await expect(page.locator('.year-display strong')).toHaveText('1900')

    const search = page.getByLabel('Find a country')
    await search.fill('Japan Asia')
    await expect(page.locator('.filters output')).toHaveText('1 result')
    await expect(page.locator('.summary article').first()).toContainText('1 countries')
    await expect(page.locator('.bubbles circle')).toHaveCount(1)
    await expect(page.locator('.table-heading')).toContainText('1 of 1 rows')
    await expect(page.locator('.table-panel tbody tr')).toHaveAttribute('data-row-key', 'Japan')

    await page.getByLabel('Select row Japan').click()
    await expect(page.locator('#history-title')).toHaveText('Japan over time')

    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export visible CSV' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('world-development-1900.csv')
    const csv = await readDownload(download)
    expect(csv.trim().split('\n')).toHaveLength(2)
    expect(csv).toContain('"Japan"')
    expect(csv).not.toContain('"France"')

    await search.fill('')
    await expect(page.locator('.filters output')).toHaveText('180 results')
    await expect(page.locator('.summary article').first()).toContainText('180 countries')
    await expect(page.locator('.table-heading')).toContainText('10 of 180 rows')

    const reportTable = page.getByRole('table', { name: 'World development rows' })
    const rows = reportTable.locator('tbody tr')
    await reportTable.getByRole('button', { name: 'Sort by Country' }).click()
    await expect(reportTable.locator('th[data-column-key="Country"]')).toHaveAttribute(
      'aria-sort',
      'ascending',
    )
    const ascending = await rowKeys(rows)
    expect(ascending).toEqual(
      ascending.toSorted((left, right) =>
        left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }),
      ),
    )

    await reportTable.getByRole('button', { name: 'Sort by Country' }).click()
    await expect(reportTable.locator('th[data-column-key="Country"]')).toHaveAttribute(
      'aria-sort',
      'descending',
    )
    expect(await rowKeys(rows)).toEqual([...ascending].reverse())

    const provenance = page.getByRole('region', { name: 'Resource provenance' })
    await provenance.locator('button[data-inspector-path="root"]').click()
    await provenance.locator('button[data-inspector-path="root.adapter"]').click()
    await expect(provenance).toContainText('duckdb')
    expect(await provenance.getByRole('treeitem').count()).toBeGreaterThan(1)

    await page.reload()
    await assertAtlas(page)
    await expect(page.locator('.report')).toHaveCount(1)
    expect(browserErrors).toEqual([])
  })
}

for (const host of hosts) {
  test(`${host.name} resolves asynchronous rows and incrementally grows a large DataTable`, async ({
    page,
  }) => {
    const browserErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') browserErrors.push(message.text())
    })
    page.on('pageerror', (error) => browserErrors.push(error.message))

    await page.goto(host.url)
    await assertTableAcceptance(page)

    expect(browserErrors).toEqual([])
  })
}

test('the migrated official interactions remain linked across views', async ({ page }) => {
  await page.goto('http://127.0.0.1:43173/')
  await assertAtlas(page)

  await expect(page.locator('.summary article').first()).toContainText('180 countries')
  const bubbles = page.locator('.bubbles circle')
  expect(await bubbles.count()).toBe(180)
  expect(
    await bubbles.evaluateAll((nodes) =>
      nodes.every((node) =>
        ['cx', 'cy', 'r'].every((name) => Number.isFinite(Number(node.getAttribute(name)))),
      ),
    ),
  ).toBe(true)

  const year = page.locator('.year-display strong')
  const initialYear = await year.textContent()
  await page.getByRole('button', { name: 'Play 209 years' }).click()
  await expect(year).not.toHaveText(initialYear ?? '')
  await page.getByRole('button', { name: 'Pause' }).click()

  const brushTarget = page.locator('.scatter-panel .brush-target')
  await brushTarget.scrollIntoViewIfNeeded()
  const brushBox = await brushTarget.boundingBox()
  if (brushBox === null) throw new Error('Scatterplot brush target has no layout box')
  await page.mouse.move(brushBox.x + brushBox.width * 0.25, brushBox.y + brushBox.height * 0.2)
  await page.mouse.down()
  await page.mouse.move(brushBox.x + brushBox.width * 0.75, brushBox.y + brushBox.height * 0.8, {
    steps: 8,
  })
  await page.mouse.up()
  await expect(page.locator('.scatter-panel .brush-box')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Clear selection' })).toBeVisible()
  await expect(page.locator('.summary article').nth(3).locator('strong')).not.toHaveText('0')
  await page.getByRole('button', { name: 'Clear selection' }).click()

  const treemapCells = page.locator('.treemap-panel .cell')
  await treemapCells.first().click()
  await expect(page.getByRole('button', { name: '← All regions' })).toBeVisible()
  expect(await treemapCells.count()).toBeGreaterThan(6)

  const historyHeading = page.locator('#history-title')
  const priorCountry = await historyHeading.textContent()
  await treemapCells.nth(1).click()
  await expect(historyHeading).not.toHaveText(priorCountry ?? '')

  const historyPath = page.locator('.history-panel path.series')
  const lifePath = await historyPath.getAttribute('d')
  await page.getByRole('button', { name: 'Income', exact: true }).click()
  await expect(page.locator('.history-panel svg')).toHaveAttribute('aria-label', /income history$/)
  expect(await historyPath.getAttribute('d')).not.toBe(lifePath)

  const japan = page.locator('.bubbles circle').filter({
    has: page.locator('title', { hasText: 'Japan' }),
  })
  await japan.click()
  await expect(historyHeading).toHaveText('Japan over time')

  const historyTarget = page.locator('.history-panel .pointer-target')
  await historyTarget.scrollIntoViewIfNeeded()
  const historyBox = await historyTarget.boundingBox()
  if (historyBox === null) throw new Error('History pointer target has no layout box')
  const yearBeforeHistoryClick = await year.textContent()
  await page.mouse.move(
    historyBox.x + historyBox.width * 0.34,
    historyBox.y + historyBox.height / 2,
  )
  await page.mouse.click(
    historyBox.x + historyBox.width * 0.34,
    historyBox.y + historyBox.height / 2,
  )
  await expect(year).not.toHaveText(yearBeforeHistoryClick ?? '')
})

async function assertAtlas(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { level: 1, name: 'World development atlas' }),
  ).toBeVisible()
  await expect(page.locator('.report svg')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Export visible CSV' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Resource provenance' })).toBeVisible()
  await expect(page.locator('[data-resource-file-count]')).toHaveText('3 typed CSV rows')
  await expect(page.locator('[data-resource-dom]')).toHaveText(
    'Resource reader fixture · ResourceFile image fixture · Tokyo',
  )
  await assertAdvancedReaders(page)
}

async function assertAdvancedReaders(page: Page): Promise<void> {
  await expect(page.locator('[data-advanced-resource-ready]')).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[data-advanced-arrow]')).toHaveText('2 rows · Tokyo, Paris · 23 trips')
  await expect(page.locator('[data-advanced-parquet]')).toHaveText(
    '2 rows · Tokyo, Paris · 23 trips',
  )
  await expect(page.locator('[data-advanced-arquero]')).toHaveText('Tokyo:14, Paris:9')
  await expect(page.locator('[data-advanced-archive]')).toHaveText(
    '5 files · a.txt, b.txt, data.json, test.xlsx, dir/nested.txt',
  )
  await expect(page.locator('[data-advanced-workbook]')).toHaveText(
    'Sheet1 · one,two,three / 1,2,3',
  )
  await expect(page.locator('[data-malformed-parquet]')).toHaveText(
    'Unable to parse resource file "malformed.parquet" as Parquet',
  )
}

async function assertTableAcceptance(page: Page): Promise<void> {
  const acceptance = page.locator('[data-table-acceptance]')
  const sourceHash = acceptance.locator('[data-table-source-hash]')
  await expect(sourceHash).toHaveText(/^[a-f0-9]{64}$/)

  const asyncTable = acceptance.locator('[data-async-table]')
  await expect(asyncTable.getByRole('status')).toHaveText('Waiting for source-backed rows')
  await asyncTable.getByRole('button', { name: 'Resolve source-backed rows' }).click()
  await expect(asyncTable.getByRole('status')).toHaveCount(0)
  await expect(asyncTable.locator('tbody tr')).toHaveCount(3)
  await expect(asyncTable.locator('tbody tr').first()).toContainText('Afghanistan')

  const incrementalTable = acceptance.locator('[data-incremental-table]')
  expect(Number(await incrementalTable.getAttribute('data-source-row-count'))).toBeGreaterThan(
    10_000,
  )
  await expect(incrementalTable.locator('[data-iterator-consumed]')).toHaveText('12')
  await expect(incrementalTable.locator('tbody tr')).toHaveCount(12)
  await expect(incrementalTable).not.toContainText('Zimbabwe')

  const viewport = incrementalTable.locator('[data-folio-table-viewport]')
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })

  await expect(incrementalTable.locator('[data-iterator-consumed]')).toHaveText('24')
  await expect(incrementalTable.locator('tbody tr')).toHaveCount(24)
}

async function readDownload(download: Download): Promise<string> {
  const stream = await download.createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

async function rowKeys(rows: ReturnType<Page['locator']>): Promise<string[]> {
  return rows.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('data-row-key') ?? ''),
  )
}
