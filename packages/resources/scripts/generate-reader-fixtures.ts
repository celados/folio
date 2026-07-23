import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { tableFromArrays, tableToIPC } from 'apache-arrow'
import { Table as ParquetTable, writeParquet } from 'parquet-wasm/node'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const fixtureRoot = resolve(packageRoot, 'src/test-fixtures')
const table = tableFromArrays({
  city: ['Tokyo', 'Paris'],
  trips: [14, 9],
})
const arrow = tableToIPC(table, 'stream')
const parquetTable = ParquetTable.fromIPCStream(arrow)
const parquet = writeParquet(parquetTable)

await mkdir(fixtureRoot, { recursive: true })
await Promise.all([
  writeFile(resolve(fixtureRoot, 'cities.arrow'), arrow),
  writeFile(resolve(fixtureRoot, 'cities.parquet'), parquet),
])
