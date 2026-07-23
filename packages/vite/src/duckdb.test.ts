// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import * as duckdb from '@duckdb/node-api'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { loadDuckDbAdapter } from './duckdb.ts'
import type { ResolvedSqlResource } from './model.ts'

const temporaryDirectories: string[] = []

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  )
})

describe('DuckDB adapter', () => {
  it('binds parameters, normalizes schema, and closes native handles', async () => {
    const directory = await temporaryDirectory()
    const inputPath = join(directory, 'values.csv')
    await writeFile(inputPath, 'name,value\nalpha,2\nbeta,4\n')
    const disconnect = vi.spyOn(duckdb.DuckDBConnection.prototype, 'disconnectSync')
    const close = vi.spyOn(duckdb.DuckDBInstance.prototype, 'closeSync')
    const adapter = await loadDuckDbAdapter()

    const artifact = await adapter.materialize(
      resource(inputPath, 'select name, cast(value * ? as integer) as doubled from values'),
    )

    expect(artifact).toEqual({
      data: [
        { doubled: 6, name: 'alpha' },
        { doubled: 12, name: 'beta' },
      ],
      schema: [
        { name: 'name', type: 'string' },
        { name: 'doubled', type: 'integer' },
      ],
    })
    expect(disconnect).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it('closes native handles when input setup fails', async () => {
    const directory = await temporaryDirectory()
    const disconnect = vi.spyOn(duckdb.DuckDBConnection.prototype, 'disconnectSync')
    const close = vi.spyOn(duckdb.DuckDBInstance.prototype, 'closeSync')
    const adapter = await loadDuckDbAdapter()

    await expect(
      adapter.materialize(resource(join(directory, 'values.txt'), 'select 1')),
    ).rejects.toThrow('Unsupported resource input format')
    expect(disconnect).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it('reports the Host dependency required to execute the adapter', async () => {
    await expect(
      loadDuckDbAdapter(async () => {
        throw new Error('module missing')
      }),
    ).rejects.toThrow('Install it as a development dependency')
  })
})

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'folio-duckdb-test-'))
  temporaryDirectories.push(directory)
  return directory
}

function resource(path: string, query: string): ResolvedSqlResource {
  return {
    adapter: 'duckdb',
    declarationHash: 'declaration',
    inputs: [{ hash: 'input', name: 'values', path, specifier: './values.csv' }],
    module: 'fixture.resource.ts',
    parameters: [3],
    query,
    resource: 'fixture',
  }
}
