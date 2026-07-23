import { flushSync } from 'ripple'
import { afterEach, describe, expect, it, vi } from 'vite-plus/test'

import { mount } from '@celados/folio'
// @ts-expect-error Folio's Vite plugin compiles public TSRX source modules.
import { DataTable } from './data-table.tsrx'
// @ts-expect-error Folio's Vite plugin compiles public TSRX source modules.
import { DownloadButton } from './download-button.tsrx'
// @ts-expect-error Folio's Vite plugin compiles public TSRX source modules.
import { Inspector } from './inspector.tsrx'
// @ts-expect-error Folio's Vite plugin compiles public TSRX source modules.
import { Search } from './search.tsrx'
// @ts-expect-error Folio's Vite plugin compiles public TSRX source modules.
import { StatusPanel } from './status-panel.tsrx'
// @ts-expect-error Folio's Vite plugin compiles the TSRX fixture.
import * as ReactiveFixtures from './test-fixtures/reactive-data.tsrx'

const { ControlledDataFixture, RICH_HEADER, ReactiveDataFixture, ReactiveInspectorFixture } =
  ReactiveFixtures

type CityRow = Readonly<{
  active: boolean
  city: string
  founded: Date
  trips: number
}>

const CITY_ROWS: readonly CityRow[] = [
  { active: true, city: 'Berlin', founded: new Date('1237-01-01T00:00:00.000Z'), trips: 50 },
  { active: false, city: 'Lisbon', founded: new Date('1147-10-25T00:00:00.000Z'), trips: 4_000 },
  { active: true, city: 'Tokyo', founded: new Date('1603-03-24T00:00:00.000Z'), trips: 300 },
]

function settle() {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      flushSync()
      resolve()
    }, 0)
  })
}

describe('DataTable', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('infers columns and applies type-aware formatting and alignment', () => {
    const target = document.createElement('div')

    mount({
      component: DataTable,
      initialProps: {
        caption: 'Trips by city',
        locale: 'en-US',
        rows: CITY_ROWS,
        select: false,
      },
      target,
    })

    expect(
      Array.from(target.querySelectorAll('th')).map((node) => node.textContent?.trim()),
    ).toEqual(['active', 'city', 'founded', 'trips'])
    expect(
      Array.from(target.querySelectorAll('td[data-column-key="trips"]')).at(1)?.textContent,
    ).toBe('4,000')
    expect(target.querySelector('td[data-column-key="trips"]')?.getAttribute('data-align')).toBe(
      'right',
    )
    expect(target.querySelector('td[data-column-key="founded"]')?.textContent).toContain(
      '1237-01-01',
    )
  })

  it('supports explicit columns, custom formatting, widths, layout, and reversible sorting', () => {
    const target = document.createElement('div')
    const onSortChange = vi.fn()

    mount({
      component: DataTable,
      initialProps: {
        caption: 'Trips by city',
        columns: [
          { header: RICH_HEADER, key: 'city', label: 'City', value: 'city', width: 180 },
          {
            align: 'right',
            format: (value: unknown) => `${value} rides`,
            key: 'trips',
            label: 'Trips',
            value: 'trips',
          },
        ],
        height: 240,
        layout: 'fixed',
        onSortChange,
        rows: CITY_ROWS,
        select: false,
        width: '42rem',
      },
      target,
    })

    const viewport = target.querySelector<HTMLElement>('[data-folio-table-viewport]')
    const table = target.querySelector<HTMLTableElement>('table')
    expect(viewport?.style.height).toBe('240px')
    expect(viewport?.style.width).toBe('42rem')
    expect(table?.style.tableLayout).toBe('fixed')
    expect(target.querySelector('th[data-column-key="city"]')?.getAttribute('style')).toContain(
      '180px',
    )
    const renderedHeader = target.querySelector<HTMLElement>('th[data-column-key="city"] abbr')
    expect(renderedHeader).not.toBeNull()
    expect(renderedHeader?.title).toBe('Municipality')
    expect(target.querySelector('td[data-column-key="trips"]')?.textContent).toBe('50 rides')

    target.querySelector<HTMLButtonElement>('th[data-column-key="trips"] button')?.click()
    flushSync()
    expect(target.querySelector('tbody tr')?.getAttribute('data-row-key')).toBe('0')
    expect(onSortChange).toHaveBeenLastCalledWith({
      column: 'trips',
      direction: 'ascending',
    })

    target.querySelector<HTMLButtonElement>('th[data-column-key="trips"] button')?.click()
    flushSync()
    expect(target.querySelector('tbody tr')?.getAttribute('data-row-key')).toBe('1')
    expect(onSortChange).toHaveBeenLastCalledWith({
      column: 'trips',
      direction: 'descending',
    })
  })

  it('renders Promise pending and resolved states without blocking the component shell', async () => {
    const target = document.createElement('div')
    let resolveRows: (rows: readonly CityRow[]) => void = () => undefined
    const rows = new Promise<readonly CityRow[]>((resolve) => {
      resolveRows = resolve
    })

    mount({
      component: DataTable,
      initialProps: {
        caption: 'Async trips',
        pendingLabel: 'Fetching trips',
        rows,
      },
      target,
    })

    expect(target.querySelector('[role="status"]')?.textContent).toContain('Fetching trips')
    resolveRows(CITY_ROWS)
    await settle()
    expect(target.querySelector('[role="status"]')).toBeNull()
    expect(target.textContent).toContain('Berlin')
  })

  it('renders Promise errors through the explicit table error state', async () => {
    const target = document.createElement('div')

    mount({
      component: DataTable,
      initialProps: {
        caption: 'Async trips',
        errorLabel: 'Trips unavailable',
        rows: Promise.reject(new Error('network failed')),
      },
      target,
    })

    await settle()
    expect(target.querySelector('[role="alert"]')?.textContent).toContain('Trips unavailable')
    expect(target.querySelector('[role="alert"]')?.textContent).toContain('network failed')
  })

  it('lazily grows the rendered window for large data', () => {
    const target = document.createElement('div')
    const rows = Array.from({ length: 100 }, (_, index) => ({ index }))

    mount({
      component: DataTable,
      initialProps: {
        batchSize: 10,
        caption: 'Large data',
        rows,
        select: false,
        visibleRowCount: 10,
      },
      target,
    })

    const viewport = target.querySelector<HTMLElement>('[data-folio-table-viewport]')
    expect(target.querySelectorAll('tbody tr')).toHaveLength(10)
    viewport?.dispatchEvent(new Event('scroll'))
    flushSync()
    expect(target.querySelectorAll('tbody tr')).toHaveLength(20)
    expect(target.textContent).not.toContain('99')
  })

  it('incrementally consumes an iterable and materializes only when full-table semantics require it', () => {
    const target = document.createElement('div')
    let consumed = 0
    const rows: Iterable<{ index: number }> = {
      [Symbol.iterator]() {
        let index = 0
        return {
          next() {
            consumed += 1
            return index < 100
              ? { done: false as const, value: { index: index++ } }
              : { done: true as const, value: undefined }
          },
        }
      },
    }

    mount({
      component: DataTable,
      initialProps: {
        caption: 'Incremental data',
        columns: [{ key: 'index', value: 'index' }],
        rows,
        select: false,
        visibleRowCount: 10,
      },
      target,
    })

    expect(consumed).toBe(10)
    expect(target.querySelectorAll('tbody tr')).toHaveLength(10)
    const viewport = target.querySelector<HTMLElement>('[data-folio-table-viewport]')
    if (!viewport) throw new Error('Expected table viewport')
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 1_000 },
      scrollTop: { configurable: true, value: 0, writable: true },
    })
    viewport.dispatchEvent(new Event('scroll'))
    flushSync()
    expect(consumed).toBe(10)

    viewport.scrollTop = 890
    viewport.dispatchEvent(new Event('scroll'))
    flushSync()
    expect(consumed).toBe(20)
    expect(target.querySelectorAll('tbody tr')).toHaveLength(20)

    target.querySelector<HTMLButtonElement>('thead button')?.click()
    flushSync()
    expect(consumed).toBe(101)
    expect(target.querySelectorAll('tbody tr')).toHaveLength(20)
  })

  it('materializes before applying an initial sort to a lazy iterable', () => {
    const target = document.createElement('div')
    const rows = Array.from({ length: 100 }, (_, index) => ({ index: 100 - index }))

    mount({
      component: DataTable,
      initialProps: {
        caption: 'Initially sorted data',
        columns: [{ key: 'index', value: 'index' }],
        rows,
        select: false,
        sort: { column: 'index', direction: 'ascending' },
        visibleRowCount: 10,
      },
      target,
    })
    flushSync()

    expect(target.querySelector('tbody tr td')?.textContent).toBe('1')
    expect(target.querySelectorAll('tbody tr')).toHaveLength(10)
  })

  it('supports multiple selection, shift ranges, and select all', () => {
    const target = document.createElement('div')
    const onSelectionChange = vi.fn()

    mount({
      component: DataTable,
      initialProps: {
        caption: 'Trips by city',
        onSelectionChange,
        rowKey: (row: CityRow) => row.city,
        rows: CITY_ROWS,
        select: 'multiple',
      },
      target,
    })

    const rowInputs = target.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')
    rowInputs[0]?.click()
    rowInputs[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    flushSync()

    expect(onSelectionChange).toHaveBeenLastCalledWith({
      keys: ['Berlin', 'Lisbon', 'Tokyo'],
      rows: CITY_ROWS,
    })
    expect(Array.from(rowInputs).every((input) => input.checked)).toBe(true)

    rowInputs[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    flushSync()
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      keys: ['Berlin', 'Lisbon'],
      rows: [CITY_ROWS[0], CITY_ROWS[1]],
    })

    rowInputs[2]?.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    flushSync()
    target.querySelector<HTMLInputElement>('thead input[type="checkbox"]')?.click()
    flushSync()
    expect(onSelectionChange).toHaveBeenLastCalledWith({ keys: [], rows: [] })
  })

  it('supports single selection and an explicit empty state', () => {
    const selectedTarget = document.createElement('div')
    const onSelectionChange = vi.fn()

    mount({
      component: DataTable,
      initialProps: {
        caption: 'Trips by city',
        onSelectionChange,
        rowKey: (row: CityRow) => row.city,
        rows: CITY_ROWS,
        select: 'single',
      },
      target: selectedTarget,
    })

    const radios = selectedTarget.querySelectorAll<HTMLInputElement>('tbody input[type="radio"]')
    radios[0]?.click()
    radios[2]?.click()
    flushSync()
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      keys: ['Tokyo'],
      rows: [CITY_ROWS[2]],
    })

    const emptyTarget = document.createElement('div')
    mount({
      component: DataTable,
      initialProps: {
        caption: 'No trips',
        emptyLabel: 'No matching trips',
        rows: [],
      },
      target: emptyTarget,
    })
    expect(emptyTarget.querySelector('[data-folio-table-empty]')?.textContent).toContain(
      'No matching trips',
    )
  })

  it('excludes disabled rows from selection and select all', () => {
    const target = document.createElement('div')
    const onSelectionChange = vi.fn()

    mount({
      component: DataTable,
      initialProps: {
        caption: 'Selectable trips',
        isRowDisabled: (row: CityRow) => row.city === 'Lisbon',
        onSelectionChange,
        rowKey: (row: CityRow) => row.city,
        rows: CITY_ROWS,
        select: 'multiple',
      },
      target,
    })

    expect(target.querySelector<HTMLInputElement>('[data-row-key="Lisbon"] input')?.disabled).toBe(
      true,
    )
    expect(target.querySelector('[data-row-key="Lisbon"]')?.getAttribute('aria-disabled')).toBe(
      'true',
    )
    target.querySelector<HTMLInputElement>('thead input')?.click()
    flushSync()
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      keys: ['Berlin', 'Tokyo'],
      rows: [CITY_ROWS[0], CITY_ROWS[2]],
    })
  })

  it('reacts when a parent replaces rows and columns', () => {
    const target = document.createElement('div')
    const onSearchChange = vi.fn()

    mount({
      component: ReactiveDataFixture,
      initialProps: { onSearchChange },
      target,
    })

    expect(target.textContent).toContain('Alpha')
    expect(target.textContent).toContain('Value')
    target.querySelector<HTMLButtonElement>('[data-toggle-data]')?.click()
    flushSync()
    expect(target.textContent).not.toContain('Alpha')
    expect(target.textContent).toContain('Gamma')
    expect(target.textContent).toContain('Place')
    expect(target.textContent).not.toContain('Value')
    expect(onSearchChange).toHaveBeenLastCalledWith([{ name: 'Gamma', value: 3 }], '')
  })

  it('synchronizes controlled query, selection, and sort props from a parent', () => {
    const target = document.createElement('div')
    const onSearchChange = vi.fn()

    mount({
      component: ControlledDataFixture,
      initialProps: { onSearchChange },
      target,
    })

    target.querySelector<HTMLButtonElement>('[data-update-controls]')?.click()
    flushSync()
    expect(target.querySelector<HTMLInputElement>('input[type="search"]')?.value).toBe('beta')
    expect(onSearchChange).toHaveBeenLastCalledWith([{ name: 'Beta', value: 2 }], 'beta')
    expect(target.querySelector<HTMLInputElement>('[data-row-key="Beta"] input')?.checked).toBe(
      true,
    )
    expect(target.querySelector('th[data-column-key="value"]')?.getAttribute('aria-sort')).toBe(
      'descending',
    )
    expect(target.querySelector('tbody tr')?.getAttribute('data-row-key')).toBe('Beta')
  })
})

describe('Search', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('filters multiple fields with all query terms and reports rows for a table', () => {
    const target = document.createElement('div')
    const onChange = vi.fn()

    mount({
      component: Search,
      initialProps: {
        columns: ['city', 'active'],
        label: 'Filter cities',
        onChange,
        rows: CITY_ROWS,
      },
      target,
    })

    const input = target.querySelector<HTMLInputElement>('input[type="search"]')
    if (!input) throw new Error('Expected search input')
    input.value = 'ber true'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()

    expect(onChange).toHaveBeenLastCalledWith([CITY_ROWS[0]], 'ber true')
    expect(target.querySelector('output')?.textContent).toBe('1 result')
  })

  it('searches every enumerable field by default and escapes regular expressions', () => {
    const target = document.createElement('div')
    const onChange = vi.fn()
    const rows = [{ label: 'C++' }, { label: 'C#' }]

    mount({
      component: Search,
      initialProps: { onChange, rows },
      target,
    })

    const input = target.querySelector<HTMLInputElement>('input')
    if (!input) throw new Error('Expected search input')
    input.value = 'c++'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    flushSync()
    expect(onChange).toHaveBeenLastCalledWith([rows[0]], 'c++')
  })
})

describe('Inspector', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('recursively inspects rich JavaScript values and circular references', () => {
    const target = document.createElement('div')
    const circular: Record<string, unknown> = { name: 'root' }
    circular.self = circular
    const value = {
      bytes: new Uint8Array([2, 4]),
      circular,
      date: new Date('2026-01-02T03:04:05.000Z'),
      error: new TypeError('invalid value'),
      map: new Map([['alpha', 1]]),
      set: new Set(['beta']),
    }

    mount({
      component: Inspector,
      initialProps: { expandedDepth: 3, label: 'Runtime value', value },
      target,
    })

    expect(target.getAttribute('role')).not.toBe('tree')
    expect(target.querySelector('[role="tree"]')).not.toBeNull()
    expect(target.textContent).toContain('Uint8Array(2)')
    expect(target.textContent).toContain('2026-01-02T03:04:05.000Z')
    expect(target.textContent).toContain('TypeError: invalid value')
    expect(target.textContent).toContain('Map(1)')
    expect(target.textContent).toContain('Set(1)')
    expect(target.textContent).toContain('[Circular]')
  })

  it('preserves independent nested expansion state while other nodes toggle', () => {
    const target = document.createElement('div')

    mount({
      component: Inspector,
      initialProps: {
        expandedDepth: 1,
        label: 'Runtime value',
        value: { alpha: { nested: 1 }, beta: { nested: 2 } },
      },
      target,
    })

    const alpha = target.querySelector<HTMLButtonElement>('[data-inspector-path="root.alpha"]')
    const beta = target.querySelector<HTMLButtonElement>('[data-inspector-path="root.beta"]')
    alpha?.click()
    beta?.click()
    flushSync()
    expect(alpha?.getAttribute('aria-expanded')).toBe('true')
    expect(beta?.getAttribute('aria-expanded')).toBe('true')

    beta?.click()
    flushSync()
    expect(alpha?.getAttribute('aria-expanded')).toBe('true')
    expect(beta?.getAttribute('aria-expanded')).toBe('false')
  })

  it('preserves expanded paths when a parent replaces the inspected value', () => {
    const target = document.createElement('div')

    mount({
      component: ReactiveInspectorFixture,
      initialProps: {},
      target,
    })

    const alpha = target.querySelector<HTMLButtonElement>('[data-inspector-path="root.alpha"]')
    alpha?.click()
    flushSync()
    expect(target.textContent).toContain('1')

    target.querySelector<HTMLButtonElement>('[data-update-inspector]')?.click()
    flushSync()
    expect(alpha?.getAttribute('aria-expanded')).toBe('true')
    expect(target.textContent).toContain('2')
    expect(target.textContent).not.toContain('1')
  })
})

describe('DownloadButton', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('downloads an asynchronous Blob and cleans up its object URL', async () => {
    const target = document.createElement('div')
    let resolveSource: (blob: Blob) => void = () => undefined
    const source = vi.fn(
      () =>
        new Promise<Blob>((resolve) => {
          resolveSource = resolve
        }),
    )
    const createObjectURL = vi.fn(() => 'blob:folio-test')
    const revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 0),
    )

    mount({
      component: DownloadButton,
      initialProps: {
        busyLabel: 'Preparing report',
        filename: 'trips.csv',
        label: 'Download CSV',
        source,
      },
      target,
    })

    const button = target.querySelector<HTMLButtonElement>('button')
    button?.click()
    flushSync()
    expect(button?.disabled).toBe(true)
    expect(button?.textContent).toBe('Preparing report')

    resolveSource(new Blob(['city,trips\nBerlin,50'], { type: 'text/csv' }))
    await settle()
    await settle()
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:folio-test')
    expect(button?.disabled).toBe(false)
    expect(button?.textContent).toBe('Download CSV')
  })

  it('shows failures and retries the source without losing the public control', async () => {
    const target = document.createElement('div')
    const onError = vi.fn()
    const source = vi
      .fn<() => Promise<Blob>>()
      .mockRejectedValueOnce(new Error('export failed'))
      .mockResolvedValueOnce(new Blob(['ok']))
    const createObjectURL = vi.fn(() => 'blob:folio-retry')
    const revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 0),
    )

    mount({
      component: DownloadButton,
      initialProps: {
        filename: 'report.csv',
        onError,
        source,
      },
      target,
    })

    target.querySelector<HTMLButtonElement>('button')?.click()
    await settle()
    expect(target.querySelector('[role="alert"]')?.textContent).toContain('export failed')
    expect(onError).toHaveBeenCalledOnce()

    target.querySelector<HTMLButtonElement>('button')?.click()
    await settle()
    await settle()
    expect(source).toHaveBeenCalledTimes(2)
    expect(target.querySelector('[role="alert"]')).toBeNull()
  })
})

describe('StatusPanel', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('exposes explicit error semantics', () => {
    const target = document.createElement('div')
    mount({
      component: StatusPanel,
      initialProps: { detail: 'Query failed', kind: 'error', title: 'Unable to load data' },
      target,
    })
    expect(target.querySelector('[role="alert"]')?.textContent).toContain('Query failed')
  })
})
