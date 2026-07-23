import type ExcelJS from 'exceljs'

import type { ResourceFileReader } from '../reader.ts'

export type ResourceWorkbookCell = boolean | Date | number | string

export type ResourceWorkbookRow = Readonly<
  Record<string, ResourceWorkbookCell> & {
    '#': number
  }
>

export type ResourceWorkbookSheet = ReadonlyArray<ResourceWorkbookRow> & {
  readonly columns: readonly string[]
}

export type ResourceWorkbookSheetOptions = Readonly<{
  headers?: boolean
  range?: string
}>

export type ResourceWorkbook = Readonly<{
  sheet(name: number | string, options?: ResourceWorkbookSheetOptions): ResourceWorkbookSheet
  sheetNames: readonly string[]
}>

export const xlsx: ResourceFileReader<ResourceWorkbook> = async (source) => {
  const buffer = await source.arrayBuffer()
  try {
    const { default: ExcelJS } = await import('exceljs')
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)
    return Object.freeze(new ResourceWorkbookValue(workbook, source.name))
  } catch (error) {
    throw new Error(`Unable to parse resource file ${JSON.stringify(source.name)} as XLSX`, {
      cause: error,
    })
  }
}

class ResourceWorkbookValue implements ResourceWorkbook {
  readonly #resourceName: string
  readonly #workbook: ExcelJS.Workbook
  readonly sheetNames: readonly string[]

  constructor(workbook: ExcelJS.Workbook, resourceName: string) {
    this.#resourceName = resourceName
    this.#workbook = workbook
    this.sheetNames = Object.freeze(workbook.worksheets.map((sheet) => sheet.name))
  }

  sheet(name: number | string, options: ResourceWorkbookSheetOptions = {}): ResourceWorkbookSheet {
    const sheetName =
      typeof name === 'number'
        ? this.sheetNames[name]
        : this.sheetNames.includes(`${name}`)
          ? `${name}`
          : undefined
    const worksheet = sheetName === undefined ? undefined : this.#workbook.getWorksheet(sheetName)
    if (worksheet === undefined) {
      throw new Error(
        `Workbook sheet ${JSON.stringify(name)} was not found in resource file ${JSON.stringify(this.#resourceName)}`,
      )
    }
    return extractWorksheet(worksheet, options, this.#resourceName)
  }
}

function extractWorksheet(
  worksheet: ExcelJS.Worksheet,
  options: ResourceWorkbookSheetOptions,
  resourceName: string,
): ResourceWorkbookSheet {
  const bounds = parseRange(options.range, worksheet, resourceName)
  const [start, end] = bounds
  const [columnStart, initialRowStart] = start
  const [columnEnd, rowEnd] = end
  const rowStart = options.headers === true ? initialRowStart + 1 : initialRowStart
  const headerRow = options.headers === true ? worksheet.getRow(rowStart) : undefined
  const names = columnNames(columnStart, columnEnd, headerRow)
  const columns = Object.freeze(names.filter((name): name is string => name !== undefined))
  const rows: ResourceWorkbookRow[] = []

  for (let rowIndex = rowStart; rowIndex <= rowEnd; rowIndex += 1) {
    // Null-prototype rows keep a "__proto__" header as data instead of mutating the row prototype.
    const row = Object.create(null) as Record<string, ResourceWorkbookCell>
    Object.defineProperty(row, '#', { value: rowIndex + 1 })
    const worksheetRow = worksheet.getRow(rowIndex + 1)

    if (worksheetRow.hasValues) {
      for (let columnIndex = columnStart; columnIndex <= columnEnd; columnIndex += 1) {
        const value = cellValue(worksheetRow.findCell(columnIndex + 1))
        const name = names[columnIndex + 1]
        if (value !== undefined && name !== undefined) row[name] = value
      }
    }
    rows.push(Object.freeze(row) as ResourceWorkbookRow)
  }

  Object.defineProperty(rows, 'columns', { enumerable: true, value: columns })
  return Object.freeze(rows) as ResourceWorkbookSheet
}

function columnNames(
  start: number,
  end: number,
  headerRow: ExcelJS.Row | undefined,
): Array<string | undefined> {
  const names = new Array<string | undefined>(start)
  const used = new Set(['#'])
  names.push('#')

  for (let column = start; column <= end; column += 1) {
    const header = headerRow === undefined ? undefined : cellValue(headerRow.findCell(column + 1))
    let name = header === undefined || `${header}`.length === 0 ? columnName(column) : `${header}`
    while (used.has(name)) name += '_'
    used.add(name)
    names.push(name)
  }
  return names
}

function cellValue(cell: ExcelJS.Cell | undefined): ResourceWorkbookCell | undefined {
  if (cell === undefined) return undefined
  const value = cell.value
  if (
    typeof value === 'boolean' ||
    typeof value === 'number' ||
    typeof value === 'string' ||
    value instanceof Date
  ) {
    return value
  }
  if (value === null || value === undefined) return undefined
  if ('formula' in value || 'sharedFormula' in value) {
    const result = value.result
    return typeof result === 'boolean' ||
      typeof result === 'number' ||
      typeof result === 'string' ||
      result instanceof Date
      ? result
      : Number.NaN
  }
  if ('richText' in value) return value.richText.map((part) => part.text).join('')
  if ('hyperlink' in value) {
    return value.hyperlink && value.hyperlink !== value.text
      ? `${value.hyperlink} ${value.text}`
      : value.text
  }
  return undefined
}

type WorkbookRange = readonly [
  readonly [column: number, row: number],
  readonly [column: number, row: number],
]

function parseRange(
  range: string | undefined,
  worksheet: ExcelJS.Worksheet,
  resourceName: string,
): WorkbookRange {
  const normalized = range ?? ':'
  const match = /^[A-Z]*\d*:[A-Z]*\d*$/.test(normalized)
  if (!match) {
    throw new Error(
      `Workbook range ${JSON.stringify(normalized)} is malformed in resource file ${JSON.stringify(resourceName)}`,
    )
  }

  const [start = '', end = ''] = normalized.split(':')
  const [columnStart = 0, rowStart = 0] = cellReference(start)
  const [columnEnd = worksheet.columnCount - 1, rowEnd = worksheet.rowCount - 1] =
    cellReference(end)
  return [
    [columnStart, rowStart],
    [columnEnd, rowEnd],
  ]
}

function columnName(index: number): string {
  let name = ''
  let value = index + 1
  do {
    name = String.fromCharCode(64 + (value % 26 || 26)) + name
    value = Math.floor((value - 1) / 26)
  } while (value > 0)
  return name
}

function cellReference(reference: string): [column: number | undefined, row: number | undefined] {
  const match = /^([A-Z]*)(\d*)$/.exec(reference)
  if (match === null) return [undefined, undefined]
  const letters = match[1] ?? ''
  const digits = match[2] ?? ''
  let column = 0

  for (let index = 0; index < letters.length; index += 1) {
    column += 26 ** (letters.length - index - 1) * ((letters.codePointAt(index) ?? 64) - 64)
  }
  return [column === 0 ? undefined : column - 1, digits.length === 0 ? undefined : +digits - 1]
}
