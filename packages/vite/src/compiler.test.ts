// @vitest-environment node

import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { compileResourceModule } from './compiler.ts'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const fixtureRoot = join(repositoryRoot, 'packages/vite/src/test-fixtures')
const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  )
})

describe('compileResourceModule', () => {
  it('generates deterministic named ESM and watches the full local input graph', async () => {
    const cacheDirectory = await temporaryDirectory()
    const id = join(fixtureRoot, 'trips.resource.ts')
    const source = await readFile(id, 'utf8')
    const first = await compileResourceModule({
      cacheDirectory,
      id,
      refresh: false,
      root: repositoryRoot,
      source,
    })
    const second = await compileResourceModule({
      cacheDirectory,
      id,
      refresh: false,
      root: repositoryRoot,
      source,
    })
    const generated = await importGeneratedModule(first)

    expect(second.code).toBe(first.code)
    expect(second.artifact).toEqual(first.artifact)
    expect(first.code).not.toContain('Berlin')
    expect(first.artifact.code).toContain('Berlin')
    expect(generated.trips.data).toEqual([
      { city: 'Berlin', trips: 50 },
      { city: 'Lisbon', trips: 40 },
    ])
    expect(Object.isFrozen(generated.trips)).toBe(true)
    expect(Object.isFrozen(generated.trips.data)).toBe(true)
    expect(first.watchFiles).toEqual(
      expect.arrayContaining([id, join(fixtureRoot, 'query.ts'), join(fixtureRoot, 'trips.csv')]),
    )
  })

  it('rejects default resource exports', async () => {
    const cacheDirectory = await temporaryDirectory()
    const id = join(fixtureRoot, 'invalid-default.resource.ts')

    await expect(
      compileResourceModule({
        cacheDirectory,
        id,
        refresh: false,
        root: repositoryRoot,
        source: await readFile(id, 'utf8'),
      }),
    ).rejects.toThrow('cannot use a default export')
  })

  it('identifies the named export when query execution fails', async () => {
    const cacheDirectory = await temporaryDirectory()
    const id = join(fixtureRoot, 'invalid-query.resource.ts')

    await expect(
      compileResourceModule({
        cacheDirectory,
        id,
        refresh: false,
        root: repositoryRoot,
        source: await readFile(id, 'utf8'),
      }),
    ).rejects.toThrow('Resource export "broken"')
  })
})

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'folio-compiler-test-'))
  temporaryDirectories.push(directory)
  return directory
}

async function importGeneratedModule(
  compiled: Awaited<ReturnType<typeof compileResourceModule>>,
): Promise<{
  trips: { data: readonly unknown[] }
}> {
  const artifactUrl = `data:text/javascript;base64,${Buffer.from(compiled.artifact.code).toString('base64')}`
  const code = compiled.code.replace(compiled.artifact.specifier, artifactUrl)
  const encoded = Buffer.from(code).toString('base64')
  return import(`data:text/javascript;base64,${encoded}`) as Promise<{
    trips: { data: readonly unknown[] }
  }>
}
