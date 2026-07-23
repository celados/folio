import { effect, track } from 'ripple'

import {
  createEntries,
  cssLength,
  formatDataTableValue,
  inferDataTableColumns,
  resolveDataTableColumns,
  sortDataTableEntries,
  type DataTableEntry,
} from './data-table-model.ts'
import type {
  DataTableProps,
  DataTableSelectionChange,
  DataTableSort,
} from './types.ts'

// Capability baseline: observablehq/inputs@04a1a8bc table; the interface remains TSRX-native.
type ResolvedDataTableProps<TRow> = Omit<DataTableProps<TRow>, 'rows'> &
  Readonly<{ rows: Iterable<TRow> }>

export function DataTable<TRow>(props: DataTableProps<TRow>) @{
  if (isPromiseLike(props.rows)) {
    return <AsyncDataTable {...props} />
  }
  <ResolvedDataTable {...props} rows={props.rows} />
}

function AsyncDataTable<TRow>(props: DataTableProps<TRow>) @{
  let &[state] = track<
    | Readonly<{ status: 'pending' }>
    | Readonly<{ error: unknown; status: 'error' }>
    | Readonly<{ rows: Iterable<TRow>; status: 'resolved' }>
  >({ status: 'pending' })

  effect(() => {
    let active = true
    state = { status: 'pending' }
    Promise.resolve(props.rows).then(
      (rows) => {
        if (active) state = { rows, status: 'resolved' }
      },
      (error: unknown) => {
        if (active) state = { error, status: 'error' }
      },
    )
    return () => {
      active = false
    }
  })

  @switch (state.status) {
    @case 'resolved': {
      <ResolvedDataTable {...props} rows={state.rows} />
    }
    @case 'error': {
      const detail = state.error instanceof Error ? state.error.message : String(state.error)
      <div class="folio-table-state folio-table-error" role="alert">
        <strong>{props.errorLabel ?? 'Unable to load data'}</strong>
        <span>{detail}</span>
      </div>
    }
    @default: {
      <div class="folio-table-state" role="status">{props.pendingLabel ?? 'Loading data…'}</div>
    }
  }
}

function ResolvedDataTable<TRow>(props: ResolvedDataTableProps<TRow>) @{
  const initialCount = Math.max(1, Math.floor(props.visibleRowCount ?? 24))
  const batchSize = Math.max(1, Math.floor(props.batchSize ?? initialCount))
  let source = props.rows
  let iterator = source[Symbol.iterator]()
  let done = false
  let &[rows] = track<readonly TRow[]>([])
  let &[visibleCount] = track(initialCount)

  function consumeTo(target: number) {
    if (done || rows.length >= target) return
    const nextRows = [...rows]
    while (!done && nextRows.length < target) {
      const next = iterator.next()
      if (next.done) {
        done = true
      } else {
        nextRows.push(next.value)
      }
    }
    rows = nextRows
  }

  function materialize() {
    if (done) return
    const nextRows = [...rows]
    while (!done) {
      const next = iterator.next()
      if (next.done) {
        done = true
      } else {
        nextRows.push(next.value)
      }
    }
    rows = nextRows
  }

  function reset(nextSource: Iterable<TRow>) {
    source = nextSource
    iterator = source[Symbol.iterator]()
    done = false
    rows = []
    visibleCount = initialCount
    consumeTo(initialCount)
  }

  consumeTo(initialCount)
  effect(() => {
    const nextSource = props.rows
    if (nextSource !== source) reset(nextSource)
  })

  let &[columns] = track(() =>
    resolveDataTableColumns(
      props.columns ?? inferDataTableColumns(rows, source),
      rows,
    ),
  )
  let &[entries] = track(() => createEntries(rows, props.rowKey))
  const selectionMode = props.select ?? 'multiple'
  let &[internalSelectedKeys] = track(new Set<string>())
  let &[selectedKeys] = track(
    () => new Set(props.selectedKeys ?? internalSelectedKeys),
  )
  let &[anchorKey] = track<string | undefined>(undefined)
  let &[headKey] = track<string | undefined>(undefined)
  let &[internalSort] = track<DataTableSort | undefined>(undefined)
  let &[currentSort] = track(() => props.sort ?? internalSort)
  let &[orderedEntries] = track(() => sortDataTableEntries(entries, columns, currentSort))
  let &[selectableEntries] = track(() =>
    orderedEntries.filter((entry) => !props.isRowDisabled?.(entry.row, entry.index)),
  )
  let &[visibleEntries] = track(() => orderedEntries.slice(0, visibleCount))

  effect(() => {
    if (currentSort) materialize()
  })

  function emitSelection(nextKeys: Set<string>) {
    const enabledKeys = new Set(selectableEntries.map((entry) => entry.key))
    const normalizedKeys = new Set(Array.from(nextKeys).filter((key) => enabledKeys.has(key)))
    if (props.selectedKeys === undefined) internalSelectedKeys = normalizedKeys
    const selection: DataTableSelectionChange<TRow> = {
      keys: orderedEntries.filter((entry) => normalizedKeys.has(entry.key)).map((entry) => entry.key),
      rows: orderedEntries.filter((entry) => normalizedKeys.has(entry.key)).map((entry) => entry.row),
    }
    props.onSelectionChange?.(selection)
  }

  function selectEntry(entry: DataTableEntry<TRow>, shiftKey: boolean) {
    if (selectionMode === false) return
    if (props.isRowDisabled?.(entry.row, entry.index)) return
    if (selectionMode === 'single') {
      anchorKey = entry.key
      emitSelection(new Set([entry.key]))
      return
    }

    const nextKeys = new Set(selectedKeys)
    if (shiftKey) {
      const anchor = anchorKey ?? nextKeys.values().next().value ?? entry.key
      if (anchorKey !== undefined && headKey !== undefined) {
        // Replacing the previous range lets Shift selection shrink as well as expand.
        const previousAnchor = orderedEntries.findIndex((candidate) => candidate.key === anchorKey)
        const previousHead = orderedEntries.findIndex((candidate) => candidate.key === headKey)
        const previousStart = Math.min(previousAnchor, previousHead)
        const previousEnd = Math.max(previousAnchor, previousHead)
        for (const candidate of orderedEntries.slice(previousStart, previousEnd + 1)) {
          nextKeys.delete(candidate.key)
        }
      }
      anchorKey = anchor
      headKey = entry.key
      const anchorIndex = orderedEntries.findIndex((candidate) => candidate.key === anchor)
      const headIndex = orderedEntries.findIndex((candidate) => candidate.key === entry.key)
      const start = Math.min(anchorIndex, headIndex)
      const end = Math.max(anchorIndex, headIndex)
      for (const candidate of orderedEntries.slice(start, end + 1)) {
        if (!props.isRowDisabled?.(candidate.row, candidate.index)) nextKeys.add(candidate.key)
      }
    } else if (nextKeys.has(entry.key)) {
      nextKeys.delete(entry.key)
      anchorKey = undefined
      headKey = undefined
    } else {
      nextKeys.add(entry.key)
      anchorKey = entry.key
      headKey = entry.key
    }
    emitSelection(nextKeys)
  }

  function selectAll() {
    materialize()
    if (selectedKeys.size === selectableEntries.length) {
      anchorKey = undefined
      headKey = undefined
      emitSelection(new Set())
      return
    }
    emitSelection(new Set(selectableEntries.map((entry) => entry.key)))
  }

  function sortBy(columnKey: string) {
    const column = columns.find((candidate) => candidate.key === columnKey)
    if (!column?.sortable) return
    materialize()
    const nextSort =
      currentSort?.column !== columnKey
        ? { column: columnKey, direction: 'ascending' }
        : currentSort.direction === 'ascending'
          ? { column: columnKey, direction: 'descending' }
          : undefined
    if (props.sort === undefined) internalSort = nextSort
    anchorKey = undefined
    headKey = undefined
    props.onSortChange?.(nextSort)
  }

  function revealMore(event: Event) {
    const viewport = event.currentTarget as HTMLElement
    const remaining = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight
    if (remaining > batchSize * 22 * 1.5) return
    const nextCount = visibleCount + batchSize
    consumeTo(nextCount)
    visibleCount = Math.min(nextCount, rows.length)
  }

  <div
    class="folio-table-scroll"
    data-folio-table-viewport
    onScroll={revealMore}
    style={{
      height: cssLength(props.height),
      maxHeight: cssLength(props.maxHeight),
      maxWidth: cssLength(props.maxWidth),
      width: cssLength(props.width),
    }}
  >
    <table style={{ tableLayout: props.layout ?? (columns.length >= 12 ? 'auto' : 'fixed') }}>
      <caption>{props.caption}</caption>
      <thead>
        <tr>
          @if (selectionMode !== false) {
            <th class="folio-table-select">
              @if (selectionMode === 'multiple') {
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  checked={selectedKeys.size > 0 && selectedKeys.size === selectableEntries.length}
                  ref={(input: HTMLInputElement) =>
                    (input.indeterminate =
                      selectedKeys.size > 0 && selectedKeys.size < selectableEntries.length)}
                  onClick={selectAll}
                />
              }
            </th>
          }
          @for (let column of columns; key column.key) {
            <th
              aria-sort={
                currentSort?.column === column.key
                  ? currentSort.direction
                  : undefined
              }
              data-column-key={column.key}
              data-align={column.align}
              style={{ width: cssLength(column.width) }}
            >
              @if (column.sortable) {
                <button
                  type="button"
                  aria-label={`Sort by ${column.label}`}
                  onClick={() => sortBy(column.key)}
                >
                  <span>{column.header}</span>
                  <span class="folio-sort-indicator" aria-hidden="true">{
                    currentSort?.column === column.key
                      ? currentSort.direction === 'ascending'
                        ? '▴'
                        : '▾'
                      : ''
                  }</span>
                </button>
              } @else {
                <span>{column.header}</span>
              }
            </th>
          }
        </tr>
      </thead>
      <tbody>
        @for (let entry of visibleEntries) {
          <tr
            data-row-key={entry.key}
            class={
              `${selectedKeys.has(entry.key) ? 'selected' : ''} ${
                props.isRowDisabled?.(entry.row, entry.index) ? 'disabled' : ''
              }`
            }
            aria-disabled={
              props.isRowDisabled?.(entry.row, entry.index) ? 'true' : undefined
            }
          >
            @if (selectionMode !== false) {
              <td class="folio-table-select">
                <input
                  type={selectionMode === 'multiple' ? 'checkbox' : 'radio'}
                  name={selectionMode === 'single' ? `${props.caption}-selection` : undefined}
                  aria-label={`Select row ${entry.key}`}
                  checked={selectedKeys.has(entry.key)}
                  disabled={props.isRowDisabled?.(entry.row, entry.index)}
                  onClick={(event: MouseEvent) => {
                    event.stopPropagation()
                    selectEntry(entry, event.shiftKey)
                  }}
                />
              </td>
            }
            @for (let column of columns; key column.key) {
              const value = column.value(entry.row, entry.index)
              const formatted =
                column.format?.(value, entry.row, entry.index) ??
                formatDataTableValue(value, props.locale)
              <td data-column-key={column.key} data-align={column.align}>{formatted}</td>
            }
          </tr>
        } @empty {
          <tr data-folio-table-empty>
            <td colspan={columns.length + (selectionMode === false ? 0 : 1)}>
              {props.emptyLabel ?? 'No results.'}
            </td>
          </tr>
        }
      </tbody>
    </table>

    <style>
      .folio-table-scroll {
        display: block;
        width: 100%;
        overflow: auto;
        color: var(--folio-ink, #17221e);
        font-family: inherit;
      }

      table {
        width: 100%;
        min-height: 33px;
        margin: 0;
        border-collapse: separate;
        border-spacing: 0;
        font-size: var(--folio-table-font-size, 12px);
        font-variant-numeric: tabular-nums;
      }

      caption {
        position: absolute;
        width: 1px;
        height: 1px;
        overflow: hidden;
        clip: rect(0 0 0 0);
        white-space: nowrap;
      }

      th,
      td {
        max-width: var(--folio-table-cell-max-width, 36rem);
        padding: 6px 10px;
        overflow: hidden;
        border-bottom: 1px solid var(--folio-line, #dce3df);
        text-align: left;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      [data-align='center'] {
        text-align: center;
      }

      [data-align='right'] {
        text-align: right;
      }

      thead th {
        position: sticky;
        z-index: 1;
        top: 0;
        border-bottom-color: var(--folio-table-header-line, #c8d1cc);
        background: var(--folio-surface, #fffffc);
        color: var(--folio-muted, #66716c);
        font-size: 10px;
        letter-spacing: 0.04em;
      }

      thead button {
        display: inline-flex;
        width: 100%;
        align-items: center;
        justify-content: inherit;
        gap: 4px;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        cursor: ns-resize;
        font: inherit;
        font-weight: 700;
        letter-spacing: inherit;
        text-align: inherit;
        text-transform: uppercase;
      }

      .folio-sort-indicator {
        display: inline-block;
        min-width: 0.75em;
      }

      .folio-table-select {
        width: 30px;
        max-width: 30px;
        padding-right: 3px;
        padding-left: 7px;
        text-align: center;
      }

      .folio-table-select input {
        margin: 0;
        accent-color: var(--folio-action, #12a594);
      }

      tbody tr:hover,
      tbody tr.selected {
        background: var(--folio-selected, #f0f7f4);
      }

      tbody tr.disabled {
        color: var(--folio-muted, #66716c);
        opacity: 0.58;
      }

      tbody tr:last-child td {
        border-bottom: 0;
      }

      [data-folio-table-empty] td {
        padding: 18px 10px;
        color: var(--folio-muted, #66716c);
        font-style: italic;
        text-align: left;
      }

      .folio-table-state {
        display: grid;
        min-height: 96px;
        place-content: center;
        gap: 5px;
        padding: 18px;
        border: 1px solid var(--folio-line, #dce3df);
        border-radius: 12px;
        color: var(--folio-muted, #66716c);
        font: inherit;
        text-align: center;
      }

      .folio-table-state span {
        font-size: 0.9em;
      }

      .folio-table-error {
        color: var(--folio-error, #a33a2b);
      }
    </style>
  </div>
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  )
}
