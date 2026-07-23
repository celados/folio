// @vitest-environment jsdom

import { afterEach, expect, it, vi } from 'vitest'
import { tableFromArrays, tableToIPC } from 'apache-arrow'
import { Table as ParquetTable, writeParquet } from 'parquet-wasm/node'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

afterEach(() => {
  vi.unstubAllGlobals()
})

it('retries browser Parquet initialization after a failed WASM load', async () => {
  vi.resetModules()
  const input = tableFromArrays({ city: ['Tokyo'], trips: [14] })
  const parquet = writeParquet(ParquetTable.fromIPCStream(tableToIPC(input, 'stream')))
  const packageRoot = process.cwd().endsWith('/packages/resources')
    ? process.cwd()
    : resolve(process.cwd(), 'packages/resources')
  const wasm = await readFile(
    resolve(packageRoot, 'node_modules/parquet-wasm/esm/parquet_wasm_bg.wasm'),
  )
  let wasmRequests = 0
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((input) => {
      if (`${input}`.includes('parquet_wasm_bg.wasm')) {
        wasmRequests += 1
        return Promise.resolve(
          wasmRequests === 1
            ? new Response(null, { status: 503, statusText: 'Unavailable' })
            : new Response(wasm, {
                headers: { 'content-type': 'application/wasm' },
              }),
        )
      }
      return Promise.resolve(new Response(Uint8Array.from(parquet).buffer))
    }),
  )
  const { ResourceFile } = await import('./index.ts')
  const { parquet: parquetReader } = await import('./readers/parquet.ts')
  const file = ResourceFile('https://example.com/cities.parquet')

  await expect(file.read(parquetReader)).rejects.toThrow(
    'Unable to parse resource file "cities.parquet" as Parquet',
  )
  await expect(file.read(parquetReader)).resolves.toMatchObject({ numRows: 1 })
  expect(wasmRequests).toBe(2)
})
