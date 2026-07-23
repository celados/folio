import type { Table as ArrowTable } from 'apache-arrow'

import type { ResourceFileReader } from '../reader.ts'

let browserParquetModule: Promise<typeof import('parquet-wasm/esm')> | undefined

export const parquet: ResourceFileReader<ArrowTable> = async (source) => {
  const buffer = await source.arrayBuffer()
  try {
    return await parseParquet(buffer)
  } catch (error) {
    throw new Error(`Unable to parse resource file ${JSON.stringify(source.name)} as Parquet`, {
      cause: error,
    })
  }
}

async function parseParquet(buffer: ArrayBuffer): Promise<ArrowTable> {
  const [arrow, parquet] = await Promise.all([
    import('apache-arrow'),
    import.meta.env.SSR ? import('parquet-wasm/node') : loadBrowserParquetModule(),
  ])
  const table = parquet.readParquet(new Uint8Array(buffer))
  return arrow.tableFromIPC(table.intoIPCStream())
}

function loadBrowserParquetModule(): Promise<typeof import('parquet-wasm/esm')> {
  if (browserParquetModule === undefined) {
    const attempt = initializeBrowserParquetModule()
    browserParquetModule = attempt
    void attempt.catch(() => {
      if (browserParquetModule === attempt) browserParquetModule = undefined
    })
  }
  return browserParquetModule
}

async function initializeBrowserParquetModule(): Promise<typeof import('parquet-wasm/esm')> {
  const [parquet, wasm] = await Promise.all([
    import('parquet-wasm/esm'),
    import('parquet-wasm/esm/parquet_wasm_bg.wasm?url'),
  ])
  await parquet.default({ module_or_path: wasm.default })
  return parquet
}
