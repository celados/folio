// @vitest-environment node

import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { build, type Rollup, type Rolldown } from 'vite'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const fixtureRoot = join(repositoryRoot, 'packages/resources/src/test-fixtures/vite')
const advancedDependencies = ['apache-arrow', 'arquero', 'exceljs', 'jszip', 'parquet-wasm']

describe('ResourceFile reader graph', () => {
  it('keeps every advanced reader out of a CSV-only client graph', async () => {
    const graph = await buildGraph('csv-only.ts')

    for (const dependency of advancedDependencies) {
      expect(graph, `${dependency} leaked into the CSV-only graph`).not.toContain(
        `/node_modules/${dependency}/`,
      )
    }
    expect(graph).not.toContain('.wasm')
  })

  it('keeps Arrow, Parquet, and WASM out of the Arquero text-reader static graph', async () => {
    const graph = await buildStaticGraph('arquero-text.ts')

    expect(graph).toContain('/readers/arquero.ts')
    expect(graph).not.toContain('/readers/arrow.ts')
    expect(graph).not.toContain('/readers/parquet.ts')
    expect(graph).not.toContain('/node_modules/apache-arrow/')
    expect(graph).not.toContain('/node_modules/parquet-wasm/')
    expect(graph).not.toContain('.wasm')
  })

  it('includes every explicitly imported advanced reader and its WASM asset', async () => {
    const graph = await buildGraph('advanced-readers.ts')

    for (const dependency of advancedDependencies) {
      expect(graph, `${dependency} is missing from the advanced graph`).toContain(
        `/node_modules/${dependency}/`,
      )
    }
    expect(graph).toContain('parquet_wasm_bg')
    expect(graph).toContain('.wasm')
    expect(graph).not.toContain('/parquet-wasm/node/')
  })

  it('selects the Node Parquet reader without browser WASM in a Vite SSR graph', async () => {
    const graph = await buildSsrGraph('advanced-readers.ts')

    expect(graph).toContain('parquet-wasm/node')
    expect(graph).not.toContain('parquet-wasm/esm')
  })
})

async function buildGraph(entry: string): Promise<string> {
  const artifacts = await buildArtifacts(entry)

  return artifacts
    .flatMap((artifact) => [
      artifact.fileName,
      ...(artifact.type === 'chunk' ? Object.keys(artifact.modules) : []),
      ...(artifact.type === 'chunk' ? [artifact.code] : []),
      ...(artifact.type === 'asset' ? [assetSourceLabel(artifact)] : []),
    ])
    .join('\n')
}

async function buildStaticGraph(entry: string): Promise<string> {
  const artifacts = await buildArtifacts(entry)
  const chunks = new Map(
    artifacts
      .filter((artifact): artifact is Rolldown.OutputChunk => artifact.type === 'chunk')
      .map((chunk) => [chunk.fileName, chunk]),
  )
  const entryChunk = [...chunks.values()].find((chunk) => chunk.isEntry)
  if (entryChunk === undefined) throw new Error(`Vite did not emit an entry for ${entry}`)

  const visited = new Set<string>()
  const visit = (chunk: Rolldown.OutputChunk): void => {
    if (visited.has(chunk.fileName)) return
    visited.add(chunk.fileName)
    for (const imported of chunk.imports) {
      const dependency = chunks.get(imported)
      if (dependency !== undefined) visit(dependency)
    }
  }
  visit(entryChunk)

  return [...visited]
    .flatMap((fileName) => {
      const chunk = chunks.get(fileName)
      return chunk === undefined ? [fileName] : [fileName, ...Object.keys(chunk.modules)]
    })
    .join('\n')
}

async function buildArtifacts(
  entry: string,
): Promise<readonly (Rolldown.OutputAsset | Rolldown.OutputChunk)[]> {
  const result = await build({
    build: {
      lib: { entry: join(fixtureRoot, entry), formats: ['es'] },
      minify: false,
      write: false,
    },
    configFile: false,
    logLevel: 'silent',
    root: repositoryRoot,
  })
  const outputs = Array.isArray(result) ? result : [result]
  return outputs.flatMap((output) => ('output' in output ? output.output : []))
}

async function buildSsrGraph(entry: string): Promise<string> {
  const result = await build({
    build: {
      minify: false,
      ssr: join(fixtureRoot, entry),
      write: false,
    },
    configFile: false,
    logLevel: 'silent',
    root: repositoryRoot,
  })
  const outputs = Array.isArray(result) ? result : [result]

  return outputs
    .flatMap((output) => ('output' in output ? output.output : []))
    .flatMap((artifact) => [
      artifact.fileName,
      ...(artifact.type === 'chunk' ? Object.keys(artifact.modules) : []),
      ...(artifact.type === 'chunk' ? [artifact.code] : []),
    ])
    .join('\n')
}

function assetSourceLabel(asset: Rollup.OutputAsset): string {
  return typeof asset.source === 'string' ? asset.source : `${asset.source.byteLength}`
}
