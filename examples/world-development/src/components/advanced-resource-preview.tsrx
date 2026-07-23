import { effect, track } from 'ripple'
import { ResourceFile } from '@celados/folio-resources'
import { arquero } from '@celados/folio-resources/readers/arquero'
import { arrow } from '@celados/folio-resources/readers/arrow'
import { parquet } from '@celados/folio-resources/readers/parquet'
import { xlsx } from '@celados/folio-resources/readers/xlsx'
import { zip } from '@celados/folio-resources/readers/zip'
import { Inspector, StatusPanel } from '@celados/folio-ui'

import archiveUrl from '../assets/advanced-archive.zip?url'
import arrowUrl from '../assets/advanced-cities.arrow?url'
import parquetUrl from '../assets/advanced-cities.parquet?url'
import malformedParquetUrl from '../assets/malformed.parquet?url'

type AdvancedReaderResults = Readonly<{
  archive: string
  arquero: string
  arrow: string
  malformedParquet: string
  parquet: string
  workbook: string
}>

type AdvancedReaderState =
  | Readonly<{ status: 'pending' }>
  | Readonly<{ detail: string; status: 'error' }>
  | Readonly<{ results: AdvancedReaderResults; status: 'ready' }>

const arrowFile = ResourceFile(arrowUrl, { name: 'cities.arrow' })
const parquetFile = ResourceFile(parquetUrl, { name: 'cities.parquet' })
const archiveFile = ResourceFile(archiveUrl, { name: 'archive.zip' })
const malformedParquetFile = ResourceFile(malformedParquetUrl, {
  name: 'malformed.parquet',
})

export function AdvancedResourcePreview() @{
  let &[state] = track<AdvancedReaderState>({ status: 'pending' })

  effect(() => {
    let active = true
    loadAdvancedReaders().then(
      (results) => {
        if (active) state = { results, status: 'ready' }
      },
      (error: unknown) => {
        if (active) {
          state = {
            detail: error instanceof Error ? error.message : String(error),
            status: 'error',
          }
        }
      },
    )
    return () => {
      active = false
    }
  })

  <section class="advanced-resource-preview" aria-labelledby="advanced-resource-title">
    <div class="advanced-resource-heading">
      <p class="eyebrow">ResourceFile · lazy reader composition</p>
      <h2 id="advanced-resource-title">Binary data without a remote runtime</h2>
      <p>
        Arrow, Parquet, Arquero, ZIP, and XLSX load through explicit ESM reader subpaths.
      </p>
    </div>

    @switch (state.status) {
      @case 'ready': {
        <div class="advanced-resource-results" data-advanced-resource-ready>
          <article>
            <span>Arrow IPC</span>
            <strong data-advanced-arrow>{state.results.arrow}</strong>
          </article>
          <article>
            <span>Parquet + WASM</span>
            <strong data-advanced-parquet>{state.results.parquet}</strong>
          </article>
          <article>
            <span>Arquero adapter</span>
            <strong data-advanced-arquero>{state.results.arquero}</strong>
          </article>
          <article>
            <span>ZIP archive</span>
            <strong data-advanced-archive>{state.results.archive}</strong>
          </article>
          <article>
            <span>Nested XLSX</span>
            <strong data-advanced-workbook>{state.results.workbook}</strong>
          </article>
          <article>
            <span>Malformed Parquet</span>
            <strong data-malformed-parquet>{state.results.malformedParquet}</strong>
          </article>
          <Inspector
            label="Advanced reader results"
            value={state.results}
            expandedDepth={1}
          />
        </div>
      }
      @case 'error': {
        <StatusPanel
          kind="error"
          title="Unable to load advanced ResourceFile readers"
          detail={state.detail}
        />
      }
      @default: {
        <StatusPanel kind="loading" title="Loading advanced ResourceFile readers" />
      }
    }

    <style>
      .advanced-resource-preview {
        display: grid;
        gap: 20px;
        margin-top: 18px;
        padding: 22px;
        border: 1px solid var(--folio-line, #dce3df);
        border-radius: 16px;
        background: var(--folio-surface, #fffffc);
      }

      .advanced-resource-heading {
        max-width: 760px;
      }

      .eyebrow {
        margin: 0 0 8px;
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
        margin: 10px 0 0;
        color: var(--folio-muted, #66716c);
        font-size: 12px;
        line-height: 1.6;
      }

      .advanced-resource-results {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }

      .advanced-resource-results article {
        display: grid;
        min-height: 84px;
        align-content: center;
        gap: 6px;
        padding: 12px;
        border: 1px solid var(--folio-line, #dce3df);
        border-radius: 12px;
        background: color-mix(in srgb, var(--folio-surface, #fffffc) 90%, #12a594 10%);
      }

      .advanced-resource-results article span {
        color: var(--folio-muted, #66716c);
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .advanced-resource-results article strong {
        overflow-wrap: anywhere;
        font-size: 11px;
        line-height: 1.5;
      }

      .advanced-resource-results > :last-child {
        grid-column: 1 / -1;
      }

      @media (max-width: 760px) {
        .advanced-resource-results {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </section>
}

async function loadAdvancedReaders(): Promise<AdvancedReaderResults> {
  const [arrowTable, parquetTable, arqueroTable, archive, malformedParquet] =
    await Promise.all([
      arrowFile.read(arrow),
      parquetFile.read(parquet),
      parquetFile.read(arquero()),
      archiveFile.read(zip),
      readMalformedParquet(),
    ])
  const workbook = await archive.file('test.xlsx').read(xlsx)
  const sheet = workbook.sheet(0)

  return {
    archive: `${archive.filenames.length} files · ${archive.filenames.join(', ')}`,
    arquero: arqueroTable
      .objects()
      .map((row) => `${String(row.city)}:${String(row.trips)}`)
      .join(', '),
    arrow: summarizeArrowTable(arrowTable),
    malformedParquet,
    parquet: summarizeArrowTable(parquetTable),
    workbook: `${workbook.sheetNames.join(', ')} · ${Array.from(
      sheet,
      (row) => `${String(row.A)},${String(row.B)},${String(row.C)}`,
    ).join(' / ')}`,
  }
}

async function readMalformedParquet(): Promise<string> {
  try {
    await malformedParquetFile.read(parquet)
    return 'Malformed Parquet was unexpectedly accepted'
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

function summarizeArrowTable(table: import('apache-arrow').Table): string {
  const cities = Array.from(table.getChild('city')?.toArray() ?? [], (value) => String(value))
  const trips = Array.from(table.getChild('trips')?.toArray() ?? [], (value) => Number(value))
  return `${table.numRows} rows · ${cities.join(', ')} · ${trips.reduce(
    (total, value) => total + value,
    0,
  )} trips`
}
