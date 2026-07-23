import type { TSRXElement } from 'ripple'

export type DataTableCell = TSRXElement | string | number | boolean | bigint | null | undefined

export type DataTableColumn<TRow> = Readonly<{
  align?: 'center' | 'left' | 'right'
  compare?: (left: unknown, right: unknown) => number
  format?: (value: unknown, row: TRow, index: number) => DataTableCell
  header?: DataTableCell
  key?: string
  label?: string
  sortable?: boolean
  value: keyof TRow | ((row: TRow, index: number) => unknown)
  width?: number | string
}>

export type DataTableSelection = false | 'multiple' | 'single'

export type DataTableSort = Readonly<{
  column: string
  direction: 'ascending' | 'descending'
}>

export type DataTableSelectionChange<TRow> = Readonly<{
  keys: readonly string[]
  rows: readonly TRow[]
}>

export type DataTableProps<TRow> = Readonly<{
  batchSize?: number
  caption: string
  columns?: readonly DataTableColumn<TRow>[]
  emptyLabel?: string
  errorLabel?: string
  height?: number | string
  isRowDisabled?: (row: TRow, index: number) => boolean
  layout?: 'auto' | 'fixed'
  locale?: string | readonly string[]
  maxHeight?: number | string
  maxWidth?: number | string
  onSelectionChange?: (selection: DataTableSelectionChange<TRow>) => void
  onSortChange?: (sort: DataTableSort | undefined) => void
  pendingLabel?: string
  rowKey?: (row: TRow, index: number) => string
  rows: Iterable<TRow> | Promise<Iterable<TRow>>
  select?: DataTableSelection
  selectedKeys?: readonly string[]
  sort?: DataTableSort
  visibleRowCount?: number
  width?: number | string
}>

export type SearchColumn<TRow> = keyof TRow | ((row: TRow) => unknown)

export type SearchProps<TRow> = Readonly<{
  columns?: readonly SearchColumn<TRow>[]
  disabled?: boolean
  filter?: (row: TRow, query: string) => boolean
  label?: string
  locale?: string | readonly string[]
  onChange: (rows: readonly TRow[], query: string) => void
  onQueryChange?: (query: string) => void
  placeholder?: string
  query?: string
  rows: Iterable<TRow>
  width?: number | string
}>

export type DownloadButtonProps = Readonly<{
  busyLabel?: string
  filename: string
  label?: string
  onError?: (error: unknown) => void
  source: Blob | (() => Blob | Promise<Blob>)
}>

export type InspectorProps = Readonly<{
  expandedDepth?: number
  label: string
  value: unknown
}>

export type StatusPanelProps = Readonly<{
  detail?: string
  kind: 'empty' | 'error' | 'loading'
  title: string
}>
