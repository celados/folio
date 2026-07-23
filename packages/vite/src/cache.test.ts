// @vitest-environment node

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { readCachedResource, writeCachedResource } from './cache.ts'
import { ARTIFACT_FORMAT_VERSION, type ResourceManifest } from './model.ts'

const temporaryDirectories: string[] = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((path) => rm(path, { force: true, recursive: true })),
  )
})

describe('resource cache', () => {
  it('round-trips a content-addressed artifact through its manifest', async () => {
    const directory = await temporaryDirectory()
    const written = await writeCachedResource(
      directory,
      'resource-key',
      { data: [{ value: 42 }], schema: [{ name: 'value', type: 'integer' }] },
      (artifactHash) => manifest('resource-key', artifactHash),
    )

    await expect(readCachedResource(directory, 'resource-key')).resolves.toEqual(written)
  })

  it('fails explicitly when an artifact no longer matches its content hash', async () => {
    const directory = await temporaryDirectory()
    const written = await writeCachedResource(
      directory,
      'resource-key',
      { data: [{ value: 42 }], schema: [{ name: 'value', type: 'integer' }] },
      (artifactHash) => manifest('resource-key', artifactHash),
    )
    const artifactPath = join(directory, 'artifacts', `${written.manifest.artifactHash}.json`)
    await writeFile(artifactPath, '{"data":[],"schema":[]}\n')

    await expect(readCachedResource(directory, 'resource-key')).rejects.toThrow(
      'Cache artifact hash mismatch',
    )
  })

  it('keeps the previous entry when a refresh cannot produce a valid manifest', async () => {
    const directory = await temporaryDirectory()
    const original = await writeCachedResource(
      directory,
      'resource-key',
      { data: [{ value: 1 }], schema: [{ name: 'value', type: 'integer' }] },
      (artifactHash) => manifest('resource-key', artifactHash),
    )
    const entryPath = join(directory, 'entries', 'resource-key.json')
    const entryBeforeRefresh = await readFile(entryPath, 'utf8')

    await expect(
      writeCachedResource(
        directory,
        'resource-key',
        { data: [{ value: 2 }], schema: [{ name: 'value', type: 'integer' }] },
        (artifactHash) => manifest('wrong-key', artifactHash),
      ),
    ).rejects.toThrow('Cache manifest does not describe')

    expect(await readFile(entryPath, 'utf8')).toBe(entryBeforeRefresh)
    await expect(readCachedResource(directory, 'resource-key')).resolves.toEqual(original)
  })
})

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'folio-cache-test-'))
  temporaryDirectories.push(directory)
  return directory
}

function manifest(key: string, artifactHash: string): ResourceManifest {
  return {
    artifactHash,
    formatVersion: ARTIFACT_FORMAT_VERSION,
    key,
    provenance: {
      adapter: { name: 'duckdb', version: 'test' },
      artifactFormatVersion: ARTIFACT_FORMAT_VERSION,
      artifactHash,
      cacheKey: key,
      declarationHash: 'declaration',
      inputs: [],
      kind: 'sql',
      module: 'fixture.resource.ts',
      resource: 'fixture',
    },
  }
}
