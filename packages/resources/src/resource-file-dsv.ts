import { autoType, dsvFormat } from 'd3-dsv'

export type ResourceFileDsvOptions = Readonly<{
  array?: boolean
  delimiter?: string
  typed?: 'auto' | boolean
}>

export type ResourceFileDsvArrayOptions = ResourceFileDsvOptions & Readonly<{ array: true }>

export type ResourceFileDsvObjectOptions = ResourceFileDsvOptions & Readonly<{ array?: false }>

export type ResourceFileDsvObjectResult = Array<Record<string, unknown>> & {
  columns: string[]
}

export type ResourceFileDsvArrayResult = unknown[][]

export type ResourceFileDsvResult = ResourceFileDsvObjectResult | ResourceFileDsvArrayResult

export function parseResourceFileDsv(
  text: string,
  options: ResourceFileDsvOptions,
): ResourceFileDsvResult {
  const delimiter = options.delimiter ?? ','
  if ([...delimiter].length !== 1) {
    throw new Error('DSV delimiter must be exactly one character')
  }

  const format = dsvFormat(delimiter)
  if (options.array === true) {
    if (!options.typed) return format.parseRows(text)
    return format.parseRows(text, (row) => autoType(row) as unknown[]) as unknown[][]
  }

  if (options.typed === true) {
    return format.parse(text, autoType) as ResourceFileDsvObjectResult
  }

  const rows = format.parse(text) as ResourceFileDsvObjectResult
  return options.typed === 'auto' ? inferColumnTypes(rows) : rows
}

// This preserves Notebook Kit's conservative column inference: a mixed column stays textual
// unless at least 90% of its sampled non-empty values agree on a richer type.
function inferColumnTypes(rows: ResourceFileDsvObjectResult): ResourceFileDsvObjectResult {
  const sampleSize = Math.min(rows.length, 100)

  for (const column of rows.columns) {
    let booleans = 0
    let dates = 0
    let numbers = 0
    let strings = 0

    for (let index = 0; index < sampleSize; index += 1) {
      const value = `${rows[index]?.[column] ?? ''}`.trim()
      if (value.length === 0) continue
      strings += 1
      if (/^(true|false)$/i.test(value)) booleans += 1
      else if (!Number.isNaN(Number(value))) numbers += 1
      else if (isDate(value)) dates += 1
    }

    const threshold = Math.max(1, Math.ceil(strings * 0.9))
    const coerce =
      booleans >= threshold
        ? coerceBoolean
        : numbers >= threshold
          ? coerceNumber
          : dates >= threshold
            ? coerceDate
            : undefined
    if (coerce === undefined) continue

    for (const row of rows) row[column] = coerce(`${row[column] ?? ''}`)
  }

  return rows
}

function coerceBoolean(value: string): boolean | null | undefined {
  const normalized = value.trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return normalized.length === 0 ? null : undefined
}

function coerceNumber(value: string): number {
  const normalized = value.trim()
  return normalized.length === 0 ? Number.NaN : Number(normalized)
}

function coerceDate(value: string): Date | null {
  const normalized = value.trim()
  return normalized.length === 0 ? null : new Date(normalized)
}

function isDate(value: string): boolean {
  return (
    /^(?:[-+]\d{2})?\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[-+]\d{2}:\d{2})?)?$/.test(
      value,
    ) ||
    /^\d{1,2}\/\d{1,2}\/\d{2,4}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{3})?)?(?:Z|[-+]\d{2}:\d{2})?)?$/.test(
      value,
    )
  )
}
