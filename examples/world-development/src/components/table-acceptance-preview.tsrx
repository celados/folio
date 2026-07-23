import { track } from 'ripple'
import { DataTable } from '@celados/folio-ui'
import type { DataTableColumn } from '@celados/folio-ui'

import type { NationHistory } from '../resources/world-development.resource.ts'

type TableAcceptancePreviewProps = {
  histories: readonly NationHistory[]
  sourceHash: string
}

type TableAcceptanceRow = Readonly<{
  country: string
  population: number
  region: string
  year: number
}>

const WINDOW_SIZE = 12
const COLUMNS: readonly DataTableColumn<TableAcceptanceRow>[] = [
  { label: 'Country', value: 'country' },
  { label: 'Region', value: 'region' },
  { align: 'right', label: 'Year', value: 'year' },
  { align: 'right', label: 'Population', value: 'population' },
]

export function TableAcceptancePreview(props: TableAcceptancePreviewProps) @{
  let &[consumed] = track(0)
  let &[asyncResolved] = track(false)
  let resolveAsyncRows: (rows: Iterable<TableAcceptanceRow>) => void = () => undefined
  const asyncRows = new Promise<Iterable<TableAcceptanceRow>>((resolve) => {
    resolveAsyncRows = resolve
  })
  const incrementalRows = createObservedRows(
    props.histories,
    WINDOW_SIZE,
    (nextConsumed) => (consumed = nextConsumed),
  )
  const totalRows = props.histories.reduce(
    (total, history) => total + history.population.length,
    0,
  )

  const resolveRows = () => {
    if (asyncResolved) return
    asyncResolved = true
    resolveAsyncRows(createResolvedRows(props.histories))
  }

  <section class="table-acceptance" data-table-acceptance aria-labelledby="table-acceptance-title">
    <div class="table-acceptance-heading">
      <p class="eyebrow">DataTable · browser acceptance</p>
      <h2 id="table-acceptance-title">Asynchronous and incremental source data</h2>
      <p>
        Both tables consume rows compiled from the same DuckDB Resource as the report.
      </p>
      <code data-table-source-hash>{props.sourceHash}</code>
    </div>

    <div class="table-acceptance-grid">
      <article data-async-table>
        <header>
          <div>
            <strong>Promise rows</strong>
            <span>Pending and resolved states</span>
          </div>
          <button type="button" disabled={asyncResolved} onClick={resolveRows}>
            Resolve source-backed rows
          </button>
        </header>
        <DataTable
          caption="Asynchronous source-backed rows"
          columns={COLUMNS}
          pendingLabel="Waiting for source-backed rows"
          rows={asyncRows}
          rowKey={(row) => `${row.country}-${row.year}`}
          select={false}
        />
      </article>

      <article data-incremental-table data-source-row-count={String(totalRows)}>
        <header>
          <div>
            <strong>Lazy iterable rows</strong>
            <span>{`${consumed} of ${totalRows} source rows consumed`}</span>
          </div>
          <output data-iterator-consumed>{String(consumed)}</output>
        </header>
        <DataTable
          batchSize={WINDOW_SIZE}
          caption="Incremental source-backed rows"
          columns={COLUMNS}
          height="220px"
          rows={incrementalRows}
          rowKey={(row) => `${row.country}-${row.year}`}
          select={false}
          visibleRowCount={WINDOW_SIZE}
        />
      </article>
    </div>

    <style>
      .table-acceptance {
        display: grid;
        gap: 20px;
        margin-top: 18px;
        padding: 22px;
        border: 1px solid var(--folio-line, #dce3df);
        border-radius: 16px;
        background: var(--folio-surface, #fffffc);
      }

      .table-acceptance-heading {
        display: grid;
        gap: 8px;
      }

      .eyebrow {
        margin: 0;
        color: var(--accent, #f05a3a);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      h2 {
        margin: 0;
        font-family: var(--serif, Iowan Old Style, Baskerville, Georgia, serif);
        font-size: clamp(24px, 3vw, 36px);
        font-weight: 500;
        letter-spacing: -0.035em;
      }

      p {
        margin: 0;
        color: var(--folio-muted, #66716c);
        font-size: 12px;
        line-height: 1.6;
      }

      code {
        overflow-wrap: anywhere;
        color: var(--folio-muted, #66716c);
        font-size: 9px;
      }

      .table-acceptance-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }

      article {
        min-width: 0;
        overflow: hidden;
        border: 1px solid var(--folio-line, #dce3df);
        border-radius: 12px;
      }

      article header {
        display: flex;
        min-height: 58px;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--folio-line, #dce3df);
      }

      article header div {
        display: grid;
        gap: 3px;
      }

      article header span {
        color: var(--folio-muted, #66716c);
        font-size: 9px;
      }

      button {
        padding: 7px 9px;
        border: 1px solid currentColor;
        border-radius: 999px;
        background: transparent;
        color: var(--folio-action, #087f72);
        cursor: pointer;
        font: inherit;
        font-size: 9px;
        font-weight: 750;
      }

      button:disabled {
        cursor: default;
        opacity: 0.45;
      }

      output {
        min-width: 28px;
        color: var(--folio-action, #087f72);
        font-size: 18px;
        font-weight: 750;
        text-align: right;
      }

      @media (max-width: 860px) {
        .table-acceptance-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </section>
}

function createResolvedRows(
  histories: readonly NationHistory[],
): readonly TableAcceptanceRow[] {
  const rows: TableAcceptanceRow[] = []
  for (const history of histories.slice(0, 3)) {
    const point = history.population.at(-1)
    if (point === undefined) continue
    rows.push(toRow(history, point))
  }
  return rows
}

function createObservedRows(
  histories: readonly NationHistory[],
  checkpoint: number,
  onConsumed: (count: number) => void,
): Iterable<TableAcceptanceRow> {
  return {
    *[Symbol.iterator]() {
      let consumed = 0
      for (const history of histories) {
        for (const point of history.population) {
          consumed += 1
          if (consumed % checkpoint === 0) {
            const nextConsumed = consumed
            // DataTable advances the iterator while rendering, so publish observation afterward.
            queueMicrotask(() => onConsumed(nextConsumed))
          }
          yield toRow(history, point)
        }
      }
    },
  }
}

function toRow(
  history: NationHistory,
  point: NationHistory['population'][number],
): TableAcceptanceRow {
  return {
    country: history.name,
    population: point[1],
    region: history.region,
    year: point[0],
  }
}
