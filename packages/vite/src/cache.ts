import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { hash, stableStringify } from './hash.ts'
import {
  ARTIFACT_FORMAT_VERSION,
  type MaterializedResource,
  type ResourceArtifact,
  type ResourceManifest,
} from './model.ts'

export async function readCachedResource(
  cacheDirectory: string,
  key: string,
): Promise<MaterializedResource | undefined> {
  const entryPath = join(cacheDirectory, 'entries', `${key}.json`)
  let manifestSource: string

  try {
    manifestSource = await readFile(entryPath, 'utf8')
  } catch (error) {
    if (isMissingFile(error)) return undefined
    throw error
  }

  const manifest = parseManifest(manifestSource, entryPath)
  if (manifest.key !== key) throw new Error(`Cache entry key mismatch at ${entryPath}`)

  const artifactPath = join(cacheDirectory, 'artifacts', `${manifest.artifactHash}.json`)
  let artifactSource: string
  try {
    artifactSource = await readFile(artifactPath, 'utf8')
  } catch (error) {
    if (isMissingFile(error)) {
      throw new Error(`Cache entry ${entryPath} points to a missing artifact`)
    }
    throw error
  }

  if (hash(artifactSource) !== manifest.artifactHash) {
    throw new Error(`Cache artifact hash mismatch at ${artifactPath}`)
  }

  return { artifact: parseArtifact(artifactSource, artifactPath), manifest }
}

export async function writeCachedResource(
  cacheDirectory: string,
  key: string,
  artifact: ResourceArtifact,
  createManifest: (artifactHash: string) => ResourceManifest,
): Promise<MaterializedResource> {
  const artifactSource = `${stableStringify(artifact)}\n`
  const artifactHash = hash(artifactSource)
  const manifest = createManifest(artifactHash)

  if (manifest.key !== key || manifest.artifactHash !== artifactHash) {
    throw new Error('Cache manifest does not describe the artifact being written')
  }

  const artifactPath = join(cacheDirectory, 'artifacts', `${artifactHash}.json`)
  const entryPath = join(cacheDirectory, 'entries', `${key}.json`)
  await writeAtomically(artifactPath, artifactSource)
  await writeAtomically(entryPath, `${stableStringify(manifest)}\n`)

  return { artifact, manifest }
}

async function writeAtomically(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`

  try {
    await writeFile(temporaryPath, contents, { flag: 'wx' })
    await rename(temporaryPath, path)
  } finally {
    await rm(temporaryPath, { force: true })
  }
}

function parseArtifact(source: string, path: string): ResourceArtifact {
  const value = parseJson(source, path)
  if (!isRecord(value) || !Array.isArray(value.data) || !Array.isArray(value.schema)) {
    throw new Error(`Invalid cache artifact at ${path}`)
  }
  return value as ResourceArtifact
}

function parseManifest(source: string, path: string): ResourceManifest {
  const value = parseJson(source, path)
  if (
    !isRecord(value) ||
    value.formatVersion !== ARTIFACT_FORMAT_VERSION ||
    typeof value.key !== 'string' ||
    typeof value.artifactHash !== 'string' ||
    !isRecord(value.provenance)
  ) {
    throw new Error(`Invalid cache manifest at ${path}`)
  }
  if (
    value.provenance.cacheKey !== value.key ||
    value.provenance.artifactHash !== value.artifactHash ||
    value.provenance.artifactFormatVersion !== value.formatVersion
  ) {
    throw new Error(`Cache manifest provenance mismatch at ${path}`)
  }
  return value as ResourceManifest
}

function parseJson(source: string, path: string): unknown {
  try {
    return JSON.parse(source)
  } catch (error) {
    throw new Error(`Invalid JSON in cache file ${path}`, { cause: error })
  }
}

function isMissingFile(error: unknown): boolean {
  return isRecord(error) && error.code === 'ENOENT'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
