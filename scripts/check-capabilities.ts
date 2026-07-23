import { readdir, readFile, stat } from 'node:fs/promises'
import { extname, resolve } from 'node:path'

type Claim = Readonly<{
  disposition: 'deleted' | 'parity' | 'tsrx-native'
  evidence: readonly string[]
  id: string
}>

type Manifest = Readonly<{
  claims: readonly Claim[]
  schemaVersion: number
  upstream: Readonly<Record<string, Readonly<{ revision: string; version: string }>>>
}>

const repositoryRoot = resolve(import.meta.dirname, '..')
const manifestPath = resolve(repositoryRoot, 'contracts/capability-evidence.json')
const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as Manifest
const sha = /^[0-9a-f]{40}$/
const dispositions = new Set(['deleted', 'parity', 'tsrx-native'])

if (manifest.schemaVersion !== 1) throw new Error('Unsupported capability evidence schema')

for (const [name, upstream] of Object.entries(manifest.upstream)) {
  if (!sha.test(upstream.revision)) {
    throw new Error(`Upstream ${name} must be pinned to a full Git revision`)
  }
  if (upstream.version.trim() === '') throw new Error(`Upstream ${name} has no pinned version`)
}

const ids = new Set<string>()
for (const claim of manifest.claims) {
  if (ids.has(claim.id)) throw new Error(`Duplicate capability claim ${claim.id}`)
  ids.add(claim.id)
  if (!dispositions.has(claim.disposition)) {
    throw new Error(`Capability ${claim.id} has an unsupported disposition`)
  }
  if (claim.evidence.length === 0) throw new Error(`Capability ${claim.id} has no evidence`)
  if (
    claim.disposition === 'parity' &&
    !claim.evidence.some(
      (path) =>
        /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path) ||
        path.startsWith('tests/browser/') ||
        path.startsWith('tests/hmr/'),
    )
  ) {
    // A source file proves existence, not behavior; parity claims require an executable consumer seam.
    throw new Error(`Parity capability ${claim.id} has no executable evidence`)
  }

  for (const path of claim.evidence) {
    if (path.startsWith('/') || path.includes('..')) {
      throw new Error(`Capability ${claim.id} has non-repository evidence ${path}`)
    }
    const evidence = await stat(resolve(repositoryRoot, path)).catch(() => undefined)
    if (evidence?.isFile() !== true) {
      throw new Error(`Capability ${claim.id} is missing evidence file ${path}`)
    }
  }
}

const forbidden = [
  ['Observable JavaScript MIME', /application\/vnd\.observable\.javascript/],
  ['Observable Runtime', /@observablehq\/runtime/],
  ['Observable stdlib', /@observablehq\/stdlib/],
  [
    'Notebook engineering symbol',
    /\b(?:defineNotebook|mountNotebook|NotebookComponent|NotebookProps)\b/,
  ],
  ['CDN runtime import', /https:\/\/cdn\.jsdelivr\.net/],
] as const

for (const root of ['packages', 'examples']) {
  for (const path of await sourceFiles(resolve(repositoryRoot, root))) {
    const source = await readFile(path, 'utf8')
    for (const [label, pattern] of forbidden) {
      if (pattern.test(source)) {
        throw new Error(`${label} leaked into ${path.slice(repositoryRoot.length + 1)}`)
      }
    }
    if (
      (extname(path) === '.tsrx' || path.includes('/examples/world-development/')) &&
      /from\s+['"]react(?:-dom)?(?:\/[^'"]*)?['"]/.test(source)
    ) {
      throw new Error(`Foreign view runtime leaked into ${path.slice(repositoryRoot.length + 1)}`)
    }
  }
}

console.log(`Verified ${manifest.claims.length} capability claims`)

async function sourceFiles(directory: string): Promise<string[]> {
  const output: string[] = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === 'dist' || entry.name === 'node_modules' || entry.name === 'test-fixtures') {
      continue
    }
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) output.push(...(await sourceFiles(path)))
    else if (['.ts', '.tsx', '.tsrx'].includes(extname(entry.name))) output.push(path)
  }
  return output
}
