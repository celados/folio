import type { DataTableCell, DataTableColumn, DataTableSort } from './types.ts'

export type DataTableEntry<TRow> = Readonly<{
  index: number
  key: string
  row: TRow
}>

export type ResolvedDataTableColumn<TRow> = Readonly<{
  align: 'center' | 'left' | 'right'
  compare: ((left: unknown, right: unknown) => number) | undefined
  format: ((value: unknown, row: TRow, index: number) => DataTableCell) | undefined
  header: DataTableCell
  key: string
  label: string
  sortable: boolean
  value: (row: TRow, index: number) => unknown
  width: number | string | undefined
}>

type ArrowLike = Readonly<{
  schema: Readonly<{
    fields: readonly Readonly<{
      name: string
      type?: Readonly<{ typeId?: number; unit?: number }>
    }>[]
  }>
}>

export function cssLength(value: number | string | undefined) {
  return typeof value === 'number' ? `${value}px` : value
}

export function createEntries<TRow>(
  rows: readonly TRow[],
  rowKey: ((row: TRow, index: number) => string) | undefined,
) {
  return rows.map((row, index) => ({
    index,
    key: rowKey?.(row, index) ?? String(index),
    row,
  }))
}

export function formatDataTableValue(
  value: unknown,
  locale: string | readonly string[] | undefined,
) {
  if (value == null) return ''
  if (typeof value === 'number') {
    if (Object.is(value, -0)) return '0'
    return value.toLocaleString(locale)
  }
  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? 'Invalid Date' : value.toISOString()
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export function inferDataTableColumns<TRow>(
  rows: readonly TRow[],
  source: Iterable<TRow>,
): readonly DataTableColumn<TRow>[] {
  const arrowFields = getArrowFields(source)
  if (arrowFields) {
    return arrowFields.map((field) => {
      const column = {
        key: field.name,
        label: field.name,
        value: field.name as keyof TRow,
      }
      return isNumericArrowField(field.type?.typeId, field.type?.unit)
        ? { ...column, align: 'right' as const }
        : column
    })
  }

  const keys = new Set<string>()
  for (const row of rows) {
    if (!isRecord(row)) continue
    for (const key of Object.keys(row)) keys.add(key)
  }
  return Array.from(keys, (key) => ({
    key,
    label: key,
    value: key as keyof TRow,
  }))
}

export function resolveDataTableColumns<TRow>(
  columns: readonly DataTableColumn<TRow>[],
  rows: readonly TRow[],
) {
  return columns.map((column, index): ResolvedDataTableColumn<TRow> => {
    const key =
      column.key ??
      (typeof column.value === 'string' || typeof column.value === 'number'
        ? String(column.value)
        : (column.label ?? String(index)))
    const accessor = column.value
    const value =
      typeof accessor === 'function'
        ? accessor
        : (row: TRow) => (row == null ? undefined : (row as Record<PropertyKey, unknown>)[accessor])
    const inferred = firstDefined(rows, value)
    return {
      align: column.align ?? (typeof inferred === 'number' ? 'right' : 'left'),
      compare: column.compare,
      format: column.format,
      header: column.header ?? column.label ?? key,
      key,
      label: column.label ?? key,
      sortable: column.sortable ?? true,
      value,
      width: column.width,
    }
  })
}

export function sortDataTableEntries<TRow>(
  entries: readonly DataTableEntry<TRow>[],
  columns: readonly ResolvedDataTableColumn<TRow>[],
  sort: DataTableSort | undefined,
) {
  if (!sort) return entries
  const column = columns.find((candidate) => candidate.key === sort.column)
  if (!column) return entries
  const direction = sort.direction === 'ascending' ? 1 : -1
  return entries.toSorted((left, right) => {
    const leftValue = column.value(left.row, left.index)
    const rightValue = column.value(right.row, right.index)
    const compared = column.compare?.(leftValue, rightValue) ?? compareValues(leftValue, rightValue)
    return compared * direction || left.index - right.index
  })
}

function compareValues(left: unknown, right: unknown) {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  if (left instanceof Date && right instanceof Date) return left.valueOf() - right.valueOf()
  if (typeof left === 'number' && typeof right === 'number') {
    if (Number.isNaN(left)) return Number.isNaN(right) ? 0 : 1
    if (Number.isNaN(right)) return -1
    return left - right
  }
  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

function firstDefined<TRow>(rows: readonly TRow[], value: (row: TRow, index: number) => unknown) {
  for (let index = 0; index < rows.length; index += 1) {
    const candidate = value(rows[index] as TRow, index)
    if (candidate != null) return candidate
  }
  return undefined
}

function getArrowFields(value: unknown) {
  if (!isArrowLike(value)) return undefined
  return value.schema.fields
}

function isArrowLike(value: unknown): value is ArrowLike {
  if (!isRecord(value) || !isRecord(value.schema)) return false
  return Array.isArray(value.schema.fields)
}

function isNumericArrowField(typeId: number | undefined, unit: number | undefined) {
  if (typeId === 2 || typeId === 3 || typeId === 7 || typeId === 9) return true
  return typeId === 8 || typeId === 10 ? unit !== 1 : false
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null
}
