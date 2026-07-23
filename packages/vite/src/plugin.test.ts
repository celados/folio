// @vitest-environment node

import { createHash } from 'node:crypto'
import { copyFile, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'
import { DuckDBInstance } from '@duckdb/node-api'
import { build } from 'vite'

import { resourceModules } from './plugin.ts'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const fixture = join(repositoryRoot, 'packages/vite/src/test-fixtures/trips.resource.ts')
const fixtureRoot = join(repositoryRoot, 'packages/vite/src/test-fixtures')
const worldDevelopmentFixture = join(
  repositoryRoot,
  'examples/world-development/src/resources/world-development.resource.ts',
)
const worldDevelopmentData = join(
  repositoryRoot,
  'examples/world-development/src/resources/world-development/nations.json',
)
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  )
})

describe('resourceModules', () => {
  it('keeps declarations, queries, native drivers, and absolute paths out of client output', async () => {
    const result = await build({
      build: {
        lib: { entry: fixture, formats: ['es'] },
        minify: false,
        write: false,
      },
      configFile: false,
      logLevel: 'silent',
      plugins: [resourceModules()],
      root: repositoryRoot,
    })

    const outputs = Array.isArray(result) ? result : [result]
    const chunks = outputs
      .flatMap((output) => ('output' in output ? output.output : []))
      .filter((output) => output.type === 'chunk')
    const source = chunks.map((output) => output.code).join('\n')
    const entry = chunks.find((output) => output.isEntry)
    const artifact = chunks.find((output) => !output.isEntry && output.code.includes('Berlin'))

    expect(source).toContain('Berlin')
    expect(entry?.code).not.toContain('Berlin')
    expect(entry?.dynamicImports).toHaveLength(1)
    expect(artifact).toBeDefined()
    expect(source).not.toContain('defineSqlResource')
    expect(source).not.toContain('DuckDBInstance')
    expect(source).not.toContain('select city')
    expect(source).not.toContain(repositoryRoot)
  })

  it('materializes the official acceptance Resource with finite numeric series', async () => {
    const dataHash = createHash('sha256')
      .update(await readFile(worldDevelopmentData))
      .digest('hex')
    expect(dataHash).toBe('d98c992ae094d397f6bbd3b941cde5f32980f47d6e3707512ea951fbfe16b8a7')

    const outputDirectory = await temporaryDirectory()
    const cacheDirectory = await temporaryDirectory()
    const result = await build({
      build: {
        lib: { entry: worldDevelopmentFixture, formats: ['es'] },
        minify: false,
        outDir: outputDirectory,
      },
      configFile: false,
      logLevel: 'silent',
      plugins: [resourceModules({ cacheDirectory })],
      root: repositoryRoot,
    })

    const outputs = Array.isArray(result) ? result : [result]
    const entry = outputs
      .flatMap((output) => ('output' in output ? output.output : []))
      .find((output) => output.type === 'chunk' && output.isEntry)

    expect(entry?.type).toBe('chunk')
    if (entry?.type !== 'chunk') throw new Error('World Development Resource entry was not emitted')

    const module = (await import(
      `${pathToFileURL(join(outputDirectory, entry.fileName)).href}?test=${Date.now()}`
    )) as {
      worldDevelopment: {
        data: readonly {
          income: readonly (readonly [number, number])[]
          lifeExpectancy: readonly (readonly [number, number])[]
          population: readonly (readonly [number, number])[]
        }[]
      }
    }

    expect(module.worldDevelopment.data).toHaveLength(180)
    for (const row of module.worldDevelopment.data) {
      for (const series of [row.income, row.lifeExpectancy, row.population]) {
        expect(series.length).toBeGreaterThan(0)
        for (const point of series) {
          expect(point).toHaveLength(2)
          expect(point.every(Number.isFinite)).toBe(true)
        }
      }
    }
  })

  it('materializes JSONL, NDJSON, and Parquet through production Vite output', async () => {
    const workspace = await fixtureWorkspace()
    const resource = join(workspace, 'formats.resource.ts')
    const parquet = join(workspace, 'events.parquet')
    const outputDirectory = join(workspace, 'dist')
    const cacheDirectory = join(workspace, 'cache')
    await Promise.all([
      copyFile(join(fixtureRoot, 'formats.resource.ts'), resource),
      copyFile(join(fixtureRoot, 'events.jsonl'), join(workspace, 'events.jsonl')),
      copyFile(join(fixtureRoot, 'events.ndjson'), join(workspace, 'events.ndjson')),
      writeParquet(parquet),
    ])

    const result = await build({
      build: {
        lib: { entry: resource, formats: ['es'] },
        minify: false,
        outDir: outputDirectory,
      },
      configFile: false,
      logLevel: 'silent',
      plugins: [resourceModules({ cacheDirectory })],
      root: repositoryRoot,
    })

    const outputs = Array.isArray(result) ? result : [result]
    const chunks = outputs
      .flatMap((output) => ('output' in output ? output.output : []))
      .filter((output) => output.type === 'chunk')
    const entry = chunks.find((output) => output.isEntry)
    const artifact = chunks.find(
      (output) =>
        !output.isEntry &&
        output.code.includes('"jsonl"') &&
        output.code.includes('"ndjson"') &&
        output.code.includes('"parquet"'),
    )
    if (!entry) throw new Error('Format Resource entry was not emitted')

    const source = chunks.map((output) => output.code).join('\n')
    expect(entry.dynamicImports).toHaveLength(1)
    expect(artifact).toBeDefined()
    expect(source).not.toContain('read_json_auto')
    expect(source).not.toContain('read_parquet')
    expect(source).not.toContain('bool_or')
    expect(source).not.toContain(workspace)

    const module = (await import(
      `${pathToFileURL(join(outputDirectory, entry.fileName)).href}?test=${Date.now()}`
    )) as FormatResources

    expect(module.jsonlEvents).toEqual({
      data: [{ active: true, source: 'jsonl', total: 5 }],
      provenance: expect.any(Object),
      schema: FORMAT_SCHEMA,
    })
    expect(module.ndjsonEvents).toEqual({
      data: [{ active: true, source: 'ndjson', total: 12 }],
      provenance: expect.any(Object),
      schema: FORMAT_SCHEMA,
    })
    expect(module.parquetEvents).toEqual({
      data: [{ active: true, source: 'parquet', total: 24 }],
      provenance: expect.any(Object),
      schema: FORMAT_SCHEMA,
    })
  })
})

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'folio-plugin-test-'))
  temporaryDirectories.push(directory)
  return directory
}

async function fixtureWorkspace(): Promise<string> {
  const directory = await mkdtemp(join(fixtureRoot, '.formats-'))
  temporaryDirectories.push(directory)
  return directory
}

async function writeParquet(path: string): Promise<void> {
  const database = await DuckDBInstance.create(':memory:')
  const connection = await database.connect()
  try {
    await connection.run(`
      copy (
        select *
        from (values ('parquet', 11, true), ('parquet', 13, false))
          as rows(source, value, active)
      ) to '${path.replaceAll("'", "''")}' (format parquet)
    `)
  } finally {
    connection.disconnectSync()
    database.closeSync()
  }
}

const FORMAT_SCHEMA = [
  { name: 'source', type: 'string' },
  { name: 'total', type: 'integer' },
  { name: 'active', type: 'boolean' },
] as const

type FormatResource = Readonly<{
  data: readonly Readonly<{ active: boolean; source: string; total: number }>[]
  provenance: unknown
  schema: typeof FORMAT_SCHEMA
}>

type FormatResources = Readonly<{
  jsonlEvents: FormatResource
  ndjsonEvents: FormatResource
  parquetEvents: FormatResource
}>
