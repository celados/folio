import { effect, track } from 'ripple'

import { cssLength } from './data-table-model.ts'
import type { SearchColumn, SearchProps } from './types.ts'

// Capability baseline: observablehq/inputs@04a1a8bc search; results cross an explicit callback seam.
export function Search<TRow>(props: SearchProps<TRow>) @{
  let &[rows] = track(() => Array.from(props.rows))
  let &[internalQuery] = track('')
  let &[query] = track(() => props.query ?? internalQuery)
  let &[filteredRows] = track(() => filterSearchRows(rows, query, props.columns, props.filter))

  effect(() => {
    props.onChange(filteredRows, query)
  })

  function update(event: InputEvent) {
    const nextQuery = (event.currentTarget as HTMLInputElement).value
    if (props.query === undefined) internalQuery = nextQuery
    props.onQueryChange?.(nextQuery)
  }

  <label class="folio-search" style={{ width: cssLength(props.width) }}>
    @if (props.label) {
      <span class="folio-search-label">{props.label}</span>
    }
    <span class="folio-search-control">
      <input
        type="search"
        disabled={props.disabled}
        placeholder={props.placeholder ?? 'Search'}
        value={query}
        onInput={update}
      />
      <output aria-live="polite">{formatResultCount(filteredRows.length, props.locale)}</output>
    </span>

    <style>
      .folio-search {
        display: grid;
        width: min(100%, 36rem);
        gap: 7px;
        color: var(--folio-ink, #17221e);
        font: inherit;
      }

      .folio-search-label {
        color: var(--folio-muted, #66716c);
        font-size: 11px;
        font-weight: 700;
      }

      .folio-search-control {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        align-items: center;
        overflow: hidden;
        border: 1px solid var(--folio-line, #dce3df);
        border-radius: 10px;
        background: var(--folio-surface, #fffffc);
      }

      input {
        min-width: 0;
        min-height: 38px;
        padding: 7px 10px;
        border: 0;
        outline: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        font-size: 12px;
      }

      input:focus-visible {
        box-shadow: inset 0 0 0 2px var(--folio-action, #12a594);
      }

      input:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      output {
        padding: 0 10px;
        color: var(--folio-muted, #66716c);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
    </style>
  </label>
}

function filterSearchRows<TRow>(
  rows: readonly TRow[],
  query: string,
  columns: readonly SearchColumn<TRow>[] | undefined,
  filter: ((row: TRow, query: string) => boolean) | undefined,
) {
  if (filter) return rows.filter((row) => filter(row, query))
  const terms = query.trim().split(/\s+/u).filter(Boolean).map(createTermPattern)
  if (terms.length === 0) return rows
  return rows.filter((row) => {
    const values = searchValues(row, columns)
    return terms.every((term) => values.some((value) => term.test(value)))
  })
}

function searchValues<TRow>(row: TRow, columns: readonly SearchColumn<TRow>[] | undefined) {
  if (columns) {
    return columns.map((column) =>
      String(typeof column === 'function' ? column(row) : row[column] ?? ''),
    )
  }
  if (typeof row !== 'object' || row === null) return [String(row)]
  return Object.values(row).map(String)
}

function createTermPattern(term: string) {
  const escaped = term.replace(/[\\^$.*+?()[\]{}|]/gu, '\\$&')
  return new RegExp(`(?:^|[^\\p{L}-])${escaped}`, 'iu')
}

function formatResultCount(length: number, locale: string | readonly string[] | undefined) {
  const count = length.toLocaleString(locale)
  return `${count} result${length === 1 ? '' : 's'}`
}
