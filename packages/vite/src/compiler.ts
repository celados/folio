import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readResourceDeclaration } from '@celados/folio-resources/internal'
import type { ResourceProvenance, SqlResourceConfig } from '@celados/folio-resources'
import { normalizePath, runnerImport } from 'vite'

import { readCachedResource, writeCachedResource } from './cache.ts'
import { loadDuckDbAdapter } from './duckdb.ts'
import { hash, stableStringify } from './hash.ts'
import { resourceCacheKey } from './identity.ts'
import {
  ARTIFACT_FORMAT_VERSION,
  type MaterializedResource,
  type ResolvedInput,
  type ResolvedSqlResource,
  type ResourceManifest,
} from './model.ts'

const INPUT_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/

export type CompileResourceModuleOptions = Readonly<{
  cacheDirectory: string
  id: string
  refresh: boolean
  root: string
  source: string
}>

export type CompiledResourceModule = Readonly<{
  artifact: Readonly<{
    code: string
    specifier: string
  }>
  code: string
  watchFiles: readonly string[]
}>

export async function compileResourceModule(
  options: CompileResourceModuleOptions,
): Promise<CompiledResourceModule> {
  const id = cleanModuleId(options.id)
  const imported = await runnerImport<Record<string, unknown>>(id, {
    configFile: false,
    logLevel: 'silent',
    root: options.root,
  })

  const entries = Object.entries(imported.module)
  if (entries.length === 0) throw new Error('Resource module has no runtime exports')

  const dependencyHashes = await hashLocalDependencies(imported.dependencies, options.root, id)
  const modulePath = normalizePath(relative(options.root, id))
  const resources: Array<readonly [string, MaterializedResource]> = []
  const watchFiles = new Set<string>([id, ...dependencyHashes.map(([path]) => path)])

  for (const [exportName, value] of entries) {
    if (exportName === 'default') throw new Error('Resource modules cannot use a default export')

    const declaration = readResourceDeclaration(value)
    if (!declaration) {
      throw new Error(
        `Runtime export ${JSON.stringify(exportName)} is not a Folio resource declaration`,
      )
    }

    try {
      const resolved = await resolveDeclaration(
        declaration.config,
        exportName,
        modulePath,
        id,
        options.source,
        dependencyHashes,
      )
      for (const input of resolved.inputs) watchFiles.add(input.path)

      resources.push([
        exportName,
        await materializeResource(resolved, options.cacheDirectory, options.refresh),
      ])
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new Error(`Resource export ${JSON.stringify(exportName)}: ${detail}`, { cause: error })
    }
  }

  const generated = generateModule(resources)

  return {
    ...generated,
    watchFiles: [...watchFiles],
  }
}

async function resolveDeclaration(
  config: SqlResourceConfig,
  resource: string,
  modulePath: string,
  id: string,
  source: string,
  dependencyHashes: readonly (readonly [string, string])[],
): Promise<ResolvedSqlResource> {
  validateConfig(config)

  const inputs = await Promise.all(
    Object.entries(config.inputs ?? {})
      .sort(([left], [right]) => left.localeCompare(right))
      .map(async ([name, specifier]): Promise<ResolvedInput> => {
        if (!INPUT_NAME.test(name)) {
          throw new Error(`Input name ${JSON.stringify(name)} is not a safe SQL identifier`)
        }
        if (isAbsolute(specifier)) {
          throw new Error(`Input ${JSON.stringify(name)} must use a module-relative path`)
        }

        const path = resolve(dirname(id), specifier)
        const contents = await readFile(path)
        return { hash: hash(contents), name, path, specifier: normalizePath(specifier) }
      }),
  )

  const declarationHash = hash(
    stableStringify({
      config,
      dependencies: dependencyHashes.map(([path, dependencyHash]) => [
        normalizePath(relative(dirname(id), path)),
        dependencyHash,
      ]),
      source: source.replaceAll('\r\n', '\n'),
    }),
  )

  return {
    adapter: config.adapter,
    declarationHash,
    inputs,
    module: modulePath,
    parameters: config.parameters ?? [],
    query: config.query,
    resource,
  }
}

async function materializeResource(
  resource: ResolvedSqlResource,
  cacheDirectory: string,
  refresh: boolean,
): Promise<MaterializedResource> {
  const adapter = await loadDuckDbAdapter()
  const cacheKey = resourceCacheKey(resource, adapter.version)

  if (!refresh) {
    const cached = await readCachedResource(cacheDirectory, cacheKey)
    if (cached) return cached
  }

  const artifact = await adapter.materialize(resource)
  assertJsonSafe(artifact)

  return writeCachedResource(cacheDirectory, cacheKey, artifact, (artifactHash) => {
    const provenance: ResourceProvenance = {
      adapter: { name: resource.adapter, version: adapter.version },
      artifactFormatVersion: ARTIFACT_FORMAT_VERSION,
      artifactHash,
      cacheKey,
      declarationHash: resource.declarationHash,
      inputs: resource.inputs.map(({ hash: inputHash, name, specifier }) => ({
        hash: inputHash,
        name,
        specifier,
      })),
      kind: 'sql',
      module: resource.module,
      resource: resource.resource,
    }

    return {
      artifactHash,
      formatVersion: ARTIFACT_FORMAT_VERSION,
      key: cacheKey,
      provenance,
    } satisfies ResourceManifest
  })
}

async function hashLocalDependencies(
  dependencies: readonly string[],
  root: string,
  resourceId: string,
): Promise<readonly (readonly [string, string])[]> {
  const rootPrefix = `${resolve(root)}/`
  const paths = [
    ...new Set(
      dependencies
        .map(cleanModuleId)
        .filter((path) => path !== resourceId && path.startsWith(rootPrefix))
        .filter((path) => !path.includes('/node_modules/')),
    ),
  ].sort()

  return Promise.all(paths.map(async (path) => [path, hash(await readFile(path))] as const))
}

function validateConfig(config: SqlResourceConfig): void {
  if (config.adapter !== 'duckdb')
    throw new Error(`Unsupported SQL adapter ${String(config.adapter)}`)
  if (typeof config.query !== 'string' || config.query.trim() === '') {
    throw new Error('SQL resource query must be a non-empty string')
  }
  if (config.inputs !== undefined && !isRecord(config.inputs)) {
    throw new Error('SQL resource inputs must be an object of module-relative paths')
  }
  for (const [name, specifier] of Object.entries(config.inputs ?? {})) {
    if (typeof specifier !== 'string' || specifier === '') {
      throw new Error(`Input ${JSON.stringify(name)} must be a non-empty module-relative path`)
    }
  }
  if (config.parameters !== undefined && !Array.isArray(config.parameters)) {
    throw new Error('SQL resource parameters must be an array')
  }
  for (const parameter of config.parameters ?? []) {
    if (
      parameter !== null &&
      typeof parameter !== 'boolean' &&
      typeof parameter !== 'number' &&
      typeof parameter !== 'string'
    ) {
      throw new Error('SQL resource parameters must contain only JSON scalar values')
    }
    if (typeof parameter === 'number' && !Number.isFinite(parameter)) {
      throw new Error('SQL resource numeric parameters must be finite')
    }
  }
}

function generateModule(
  resources: readonly (readonly [string, MaterializedResource])[],
): Pick<CompiledResourceModule, 'artifact' | 'code'> {
  const values = Object.fromEntries(
    resources.map(([name, { artifact, manifest }]) => [
      name,
      { ...artifact, provenance: manifest.provenance },
    ]),
  )
  const serialized = stableStringify(values)
  const specifier = `virtual:folio-resource/${hash(serialized)}`
  const exports = resources.map(([name]) => `export const ${name} = freeze(resources.${name})`)

  return {
    artifact: {
      code: `export const resources = ${serialized}\n`,
      specifier,
    },
    code: [
      `const { resources } = await import(${JSON.stringify(specifier)})`,
      'const freeze = (value) => {',
      "  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value",
      '  for (const child of Object.values(value)) freeze(child)',
      '  return Object.freeze(value)',
      '}',
      ...exports,
      '',
    ].join('\n'),
  }
}

function assertJsonSafe(value: unknown): void {
  const seen = new WeakSet<object>()
  visitJsonValue(value, seen)
}

function visitJsonValue(value: unknown, seen: WeakSet<object>): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return
  if (typeof value === 'number' && Number.isFinite(value)) return
  if (typeof value !== 'object') {
    throw new Error(`Resource adapter returned a non-JSON-safe ${typeof value} value`)
  }
  if (seen.has(value)) throw new Error('Resource adapter returned a cyclic value')
  seen.add(value)

  if (Array.isArray(value)) {
    for (const child of value) visitJsonValue(child, seen)
  } else {
    const prototype = Object.getPrototypeOf(value) as object | null
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('Resource adapter returned a non-plain object')
    }
    for (const child of Object.values(value)) visitJsonValue(child, seen)
  }

  seen.delete(value)
}

function cleanModuleId(id: string): string {
  const clean = id.split('?', 1)[0] ?? id
  return clean.startsWith('file:') ? fileURLToPath(clean) : clean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
