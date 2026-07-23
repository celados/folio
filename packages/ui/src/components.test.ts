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
import { StatusPanel } from './status-panel.tsrx'

describe('@celados/folio-ui', () => {
  afterEach(() => {
    document.body.replaceChildren()
    vi.restoreAllMocks()
  })

  it('renders typed rows and reports the selected value', () => {
    const target = document.createElement('div')
    const onSelect = vi.fn()
    const rows = [
      { city: 'Berlin', trips: 50 },
      { city: 'Lisbon', trips: 40 },
    ]

    mount({
      component: DataTable,
      initialProps: {
        caption: 'Trips by city',
        columns: [
          { label: 'City', value: (row: (typeof rows)[number]) => row.city },
          {
            align: 'right',
            label: 'Trips',
            value: (row: (typeof rows)[number]) => String(row.trips),
          },
        ],
        onSelect,
        rowKey: (row: (typeof rows)[number]) => row.city,
        rows,
      },
      target,
    })

    expect(target.textContent).toContain('Berlin')
    target.querySelector<HTMLElement>('[data-row-key="Lisbon"]')?.click()
    expect(onSelect).toHaveBeenCalledWith(rows[1])
  })

  it('downloads component-owned content with the declared filename and media type', () => {
    const target = document.createElement('div')
    const createObjectURL = vi.fn(() => 'blob:folio-test')
    const revokeObjectURL = vi.fn()
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })

    mount({
      component: DownloadButton,
      initialProps: {
        content: () => 'city,trips\nBerlin,50',
        filename: () => 'trips.csv',
        label: 'Download CSV',
        mediaType: 'text/csv',
      },
      target,
    })
    target.querySelector<HTMLButtonElement>('button')?.click()

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:folio-test')
  })

  it('keeps inspection explicit and exposes status semantics', () => {
    const inspectorTarget = document.createElement('div')
    mount({
      component: Inspector,
      initialProps: { label: 'Provenance', value: { adapter: 'duckdb' } },
      target: inspectorTarget,
    })

    expect(inspectorTarget.querySelector('pre')).toBeNull()
    inspectorTarget.querySelector<HTMLButtonElement>('button')?.click()
    flushSync()
    expect(inspectorTarget.querySelector('pre')?.textContent).toContain('duckdb')

    const statusTarget = document.createElement('div')
    mount({
      component: StatusPanel,
      initialProps: { detail: 'Query failed', kind: 'error', title: 'Unable to load data' },
      target: statusTarget,
    })
    expect(statusTarget.querySelector('[role="alert"]')?.textContent).toContain('Query failed')
  })
})
