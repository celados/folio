// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { tableFromArrays, tableToIPC } from 'apache-arrow'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Table as ParquetTable, writeParquet } from 'parquet-wasm/node'
import JSZip from 'jszip'
import ExcelJS from 'exceljs'

import { ResourceFile } from './index.ts'
import { arquero } from './readers/arquero.ts'
import { arrow } from './readers/arrow.ts'
import { parquet } from './readers/parquet.ts'
import { xlsx } from './readers/xlsx.ts'
import { zip } from './readers/zip.ts'

describe('ResourceFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a resource value from a URL with explicit metadata', () => {
    const source = new URL('https://example.com/files/measurements.csv')
    const file = ResourceFile(source, {
      lastModified: 1_725_000_000_000,
      mimeType: 'text/csv',
      name: 'observations.csv',
      size: 128,
    })

    expect(file).toMatchObject({
      href: 'https://example.com/files/measurements.csv',
      lastModified: 1_725_000_000_000,
      mimeType: 'text/csv',
      name: 'observations.csv',
      size: 128,
    })
    expect(Object.isFrozen(file)).toBe(true)
  })

  it('accepts emitted and inlined Vite asset URLs without a registry', () => {
    const emitted = ResourceFile('/assets/cities.abc123.csv', {
      base: 'https://example.com/report/',
    })
    expect(emitted).toMatchObject({
      href: 'https://example.com/assets/cities.abc123.csv',
      mimeType: 'text/csv',
      name: 'cities.abc123.csv',
    })

    const inlined = ResourceFile('data:text/csv,city%0ATokyo')
    expect(inlined).toMatchObject({
      href: 'data:text/csv,city%0ATokyo',
      mimeType: 'text/csv',
      name: 'resource',
    })
  })

  it('preserves a Vite root-relative asset URL during SSR module evaluation', () => {
    vi.stubGlobal('document', { baseURI: 'about:blank' })

    const file = ResourceFile('/@fs/workspace/src/cities.csv?url')

    expect(file).toMatchObject({
      href: '/@fs/workspace/src/cities.csv?url',
      mimeType: 'text/csv',
      name: 'cities.csv',
    })
  })

  it('reads the same fetched bytes as blob, array buffer, text, JSON, and stream', async () => {
    const source = 'data:application/json,%7B%22city%22%3A%22Tokyo%22%7D'
    const file = ResourceFile(source, { name: 'city.json' })

    await expect(file.text()).resolves.toBe('{"city":"Tokyo"}')
    await expect(file.json<{ city: string }>()).resolves.toEqual({ city: 'Tokyo' })

    const blob = await file.blob()
    expect(blob.type).toBe('application/json')
    expect(await blob.text()).toBe('{"city":"Tokyo"}')

    const bytes = new Uint8Array(await file.arrayBuffer())
    expect(new TextDecoder().decode(bytes)).toBe('{"city":"Tokyo"}')

    const reader = (await file.stream()).getReader()
    const chunk = await reader.read()
    expect(new TextDecoder().decode(chunk.value)).toBe('{"city":"Tokyo"}')
    expect((await reader.read()).done).toBe(true)
  })

  it('parses CSV and TSV with object, array, and inferred column types', async () => {
    const csv = ResourceFile(
      'data:text/csv,city%2Ccount%2Cactive%2Cdate%0ATokyo%2C14%2Ctrue%2C2026-07-01%0AParis%2C9%2Cfalse%2C2026-07-02',
      { name: 'cities.csv' },
    )

    const rows = await csv.csv({ typed: 'auto' })
    expect(rows.columns).toEqual(['city', 'count', 'active', 'date'])
    expect(Array.from(rows)).toEqual([
      { active: true, city: 'Tokyo', count: 14, date: new Date('2026-07-01') },
      { active: false, city: 'Paris', count: 9, date: new Date('2026-07-02') },
    ])

    const tsv = ResourceFile('data:text/tab-separated-values,city%09count%0ATokyo%0914', {
      name: 'cities.tsv',
    })
    await expect(tsv.tsv({ array: true, typed: true })).resolves.toEqual([
      ['city', 'count'],
      ['Tokyo', 14],
    ])

    const custom = ResourceFile('data:text/plain,city%3Bcount%0ATokyo%3B14', {
      name: 'cities.txt',
    })
    expect(Array.from(await custom.dsv({ delimiter: ';' }))).toEqual([
      { city: 'Tokyo', count: '14' },
    ])
  })

  it('parses XML and HTML documents and rejects malformed XML', async () => {
    const xml = ResourceFile(
      'data:application/xml,%3Ccities%3E%3Ccity%20population%3D%2214%22%3ETokyo%3C%2Fcity%3E%3C%2Fcities%3E',
      { name: 'cities.xml' },
    )
    const xmlDocument = await xml.xml()
    expect(xmlDocument.documentElement.localName).toBe('cities')
    expect(xmlDocument.querySelector('city')?.textContent).toBe('Tokyo')

    const html = ResourceFile(
      'data:text/html,%3C!doctype%20html%3E%3Ctitle%3ECities%3C%2Ftitle%3E%3Ch1%3ETokyo%3C%2Fh1%3E',
      { name: 'cities.html' },
    )
    const htmlDocument = await html.html()
    expect(htmlDocument.title).toBe('Cities')
    expect(htmlDocument.querySelector('h1')?.textContent).toBe('Tokyo')

    const malformed = ResourceFile('data:application/xml,%3Ccity%3E', {
      name: 'malformed.xml',
    })
    await expect(malformed.xml()).rejects.toThrow(
      'Unable to parse resource file "malformed.xml" as application/xml',
    )
  })

  it('loads an image with caller properties and a resolved asset URL', async () => {
    class LoadedImage {
      alt = ''
      crossOrigin: string | null = null
      height = 0
      onerror: OnErrorEventHandler = null
      onload: ((event: Event) => void) | null = null
      src = ''
      width = 0

      constructor() {
        queueMicrotask(() => this.onload?.(new Event('load')))
      }
    }
    vi.stubGlobal('Image', LoadedImage)

    const file = ResourceFile('/assets/map.abc123.png', {
      base: 'https://example.com/report/',
      name: 'map.png',
    })
    const image = await file.image({
      alt: 'Mobility map',
      crossOrigin: 'use-credentials',
      width: 640,
    })

    expect(image).toMatchObject({
      alt: 'Mobility map',
      crossOrigin: 'use-credentials',
      src: 'https://example.com/assets/map.abc123.png',
      width: 640,
    })
  })

  it('distinguishes loading failures from reader parsing failures', async () => {
    const missing = ResourceFile('https://example.com/missing.json')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 404, statusText: 'Not Found' })),
    )

    await expect(missing.json()).rejects.toThrow(
      'Unable to load resource file "missing.json" from "https://example.com/missing.json": 404 Not Found',
    )

    vi.unstubAllGlobals()
    const malformed = ResourceFile('data:application/json,%7B', { name: 'malformed.json' })
    await expect(malformed.json()).rejects.toThrow(
      'Unable to parse resource file "malformed.json" as JSON',
    )
  })

  it('reads Arrow IPC into an Apache Arrow table', async () => {
    const input = tableFromArrays({
      city: ['Tokyo', 'Paris'],
      trips: [14, 9],
    })
    const ipc = tableToIPC(input, 'stream')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(Uint8Array.from(ipc).buffer)))

    const table = await ResourceFile('https://example.com/cities.arrow').read(arrow)

    expect(table.numRows).toBe(2)
    expect(table.getChild('city')?.toArray()).toEqual(['Tokyo', 'Paris'])
    expect(table.getChild('trips')?.toArray()).toEqual(new Float64Array([14, 9]))
  })

  it('reads Parquet into an Apache Arrow table', async () => {
    const input = tableFromArrays({
      city: ['Tokyo', 'Paris'],
      trips: [14, 9],
    })
    const parquetTable = ParquetTable.fromIPCStream(tableToIPC(input, 'stream'))
    const parquetBytes = writeParquet(parquetTable)
    const packageRoot = process.cwd().endsWith('/packages/resources')
      ? process.cwd()
      : resolve(process.cwd(), 'packages/resources')
    const wasm = await readFile(
      resolve(packageRoot, 'node_modules/parquet-wasm/esm/parquet_wasm_bg.wasm'),
    )
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((input) =>
          Promise.resolve(
            `${input}`.includes('parquet_wasm_bg.wasm')
              ? new Response(wasm, { headers: { 'content-type': 'application/wasm' } })
              : new Response(Uint8Array.from(parquetBytes).buffer),
          ),
        ),
    )

    const table = await ResourceFile('https://example.com/cities.parquet').read(parquet)

    expect(table.numRows).toBe(2)
    expect(table.getChild('city')?.toArray()).toEqual(['Tokyo', 'Paris'])
    expect(table.getChild('trips')?.toArray()).toEqual(new Float64Array([14, 9]))
  })

  it('opens ZIP archives through a small entry reader interface', async () => {
    const archiveBytes = await readFile(
      resolve(
        process.cwd().endsWith('/packages/resources')
          ? process.cwd()
          : resolve(process.cwd(), 'packages/resources'),
        'src/test-fixtures/archive.zip',
      ),
    )
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(Uint8Array.from(archiveBytes).buffer)),
    )

    const archive = await ResourceFile('https://example.com/archive.zip').read(zip)

    expect(archive.filenames).toEqual([
      'a.txt',
      'b.txt',
      'data.json',
      'test.xlsx',
      'dir/nested.txt',
    ])
    await expect(archive.file('a.txt').text()).resolves.toBe('alpha')
    await expect(archive.file('data.json').json<{ a: number }>()).resolves.toMatchObject({
      a: 1,
    })
    expect(new TextDecoder().decode(await archive.file('b.txt').arrayBuffer())).toBe('beta')
    expect((await archive.file('a.txt').stream()).getReader()).toBeDefined()
    expect(archive.file('data.json')).toMatchObject({
      mimeType: 'application/json',
      name: 'data.json',
    })
    const nestedWorkbook = await archive.file('test.xlsx').read(xlsx)
    expect(nestedWorkbook.sheetNames).toEqual(['Sheet1'])
    expect(Array.from(nestedWorkbook.sheet(0))).toEqual([
      { A: 'one', B: 'two', C: 'three' },
      { A: 1, B: 2, C: 3 },
    ])
    expect(() => archive.file('missing.txt')).toThrow(
      'ZIP entry "missing.txt" was not found in resource file "archive.zip"',
    )
    expect(() => archive.file('dir/')).toThrow(
      'ZIP entry "dir/" was not found in resource file "archive.zip"',
    )
  })

  it('reads XLSX workbooks through names, ranges, and header extraction', async () => {
    const fixture = await readFile(
      resolve(
        process.cwd().endsWith('/packages/resources')
          ? process.cwd()
          : resolve(process.cwd(), 'packages/resources'),
        'src/test-fixtures/archive.zip',
      ),
    )
    const archive = await JSZip.loadAsync(fixture)
    const entry = archive.file('test.xlsx')
    if (entry === null) throw new Error('XLSX fixture is missing')
    const xlsxBytes = await entry.async('uint8array')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(Uint8Array.from(xlsxBytes).buffer)),
    )

    const workbook = await ResourceFile('https://example.com/test.xlsx').read(xlsx)

    expect(workbook.sheetNames).toEqual(['Sheet1'])
    const sheet = workbook.sheet(0)
    expect(sheet.columns).toEqual(['#', 'A', 'B', 'C'])
    expect(Array.from(sheet, (row) => ({ ...row, '#': row['#'] }))).toEqual([
      { '#': 1, A: 'one', B: 'two', C: 'three' },
      { '#': 2, A: 1, B: 2, C: 3 },
    ])
    expect(Array.from(workbook.sheet('Sheet1', { headers: true }))).toEqual([
      { one: 1, three: 3, two: 2 },
    ])
    expect(Array.from(workbook.sheet(0, { range: 'B1:C2' }))).toEqual([
      { B: 'two', C: 'three' },
      { B: 2, C: 3 },
    ])
    expect(() => workbook.sheet('missing')).toThrow(
      'Workbook sheet "missing" was not found in resource file "test.xlsx"',
    )
    expect(() => workbook.sheet(0, { range: 'bad' })).toThrow('Workbook range "bad" is malformed')
  })

  it('preserves workbook dates, rich text, hyperlinks, formulas, and safe headers', async () => {
    const input = new ExcelJS.Workbook()
    const worksheet = input.addWorksheet('Typed')
    worksheet.addRow(['__proto__', 'label', 'link', 'total'])
    worksheet.addRow([
      new Date('2026-07-23T00:00:00.000Z'),
      { richText: [{ text: 'north' }, { text: 'bound' }] },
      { hyperlink: 'https://example.com/data', text: 'source' },
      { formula: '2*7', result: 14 },
    ])
    const bytes = await input.xlsx.writeBuffer()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(Uint8Array.from(new Uint8Array(bytes)).buffer)),
    )

    const workbook = await ResourceFile('https://example.com/typed.xlsx').read(xlsx)
    const [row] = workbook.sheet('Typed', { headers: true })
    if (row === undefined) throw new Error('Typed workbook row is missing')

    expect(Object.getPrototypeOf(row)).toBeNull()
    expect(row['__proto__']).toEqual(new Date('2026-07-23T00:00:00.000Z'))
    expect(row).toMatchObject({
      label: 'northbound',
      link: 'https://example.com/data source',
      total: 14,
    })
  })

  it('converts JSON into an Arquero table and forwards parser options', async () => {
    const file = ResourceFile(
      'data:application/json,%5B%7B%22city%22%3A%22Tokyo%22%2C%22date%22%3A%222026-07-23%22%7D%5D',
      { name: 'cities.json' },
    )

    const table = await file.read(arquero({ autoType: false }))

    expect(table.objects()).toEqual([{ city: 'Tokyo', date: '2026-07-23' }])
  })

  it('converts CSV and TSV into Arquero tables with delimiter options', async () => {
    const csv = ResourceFile('data:text/csv,city%2Ctrips%0ATokyo%2C14', {
      name: 'cities.csv',
    })
    expect((await csv.read(arquero({ autoType: false }))).objects()).toEqual([
      { city: 'Tokyo', trips: '14' },
    ])

    const tsv = ResourceFile('data:text/tab-separated-values,city%7Ctrips%0ATokyo%7C14', {
      name: 'cities.tsv',
    })
    expect((await tsv.read(arquero({ delimiter: '|' }))).objects()).toEqual([
      { city: 'Tokyo', trips: 14 },
    ])
  })

  it('converts Arrow and Parquet into Arquero tables', async () => {
    const input = tableFromArrays({
      city: ['Tokyo', 'Paris'],
      trips: [14, 9],
    })
    const ipc = tableToIPC(input, 'stream')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(Uint8Array.from(ipc).buffer)))
    const arrowResult = await ResourceFile('https://example.com/cities.arrow').read(
      arquero({ columns: ['city'] }),
    )
    expect(arrowResult.columnNames()).toEqual(['city'])
    expect(arrowResult.objects()).toEqual([{ city: 'Tokyo' }, { city: 'Paris' }])

    const parquetTable = ParquetTable.fromIPCStream(ipc)
    const parquet = writeParquet(parquetTable)
    const packageRoot = process.cwd().endsWith('/packages/resources')
      ? process.cwd()
      : resolve(process.cwd(), 'packages/resources')
    const wasm = await readFile(
      resolve(packageRoot, 'node_modules/parquet-wasm/esm/parquet_wasm_bg.wasm'),
    )
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation((input) =>
          Promise.resolve(
            `${input}`.includes('parquet_wasm_bg.wasm')
              ? new Response(wasm, { headers: { 'content-type': 'application/wasm' } })
              : new Response(Uint8Array.from(parquet).buffer),
          ),
        ),
    )
    const parquetResult = await ResourceFile('https://example.com/cities.parquet').read(
      arquero({ columns: ['trips'] }),
    )
    expect(parquetResult.columnNames()).toEqual(['trips'])
    expect(parquetResult.objects()).toEqual([{ trips: 14 }, { trips: 9 }])
  })

  it('rejects an unsupported Arquero source before loading it', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    await expect(ResourceFile('https://example.com/cities.bin').read(arquero())).rejects.toThrow(
      'Unable to determine an Arquero reader for resource file "cities.bin" with MIME type "application/octet-stream"',
    )
    expect(fetch).not.toHaveBeenCalled()
  })
})
