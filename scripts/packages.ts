import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repositoryRoot = resolve(import.meta.dirname, '..')
const artifactDirectory = resolve(repositoryRoot, '.artifacts/packages')
const publicPackages = [
  { directory: 'packages/resources', name: '@celados/folio-resources' },
  { directory: 'packages/core', name: '@celados/folio' },
  { directory: 'packages/ui', name: '@celados/folio-ui' },
  { directory: 'packages/react', name: '@celados/folio-react' },
  { directory: 'packages/vite', name: '@celados/folio-vite' },
] as const

type Manifest = {
  dependencies?: Record<string, string>
  files?: string[]
  name: string
  private?: boolean
  publishConfig?: { registry?: string }
  version: string
}

const manifests = await Promise.all(
  publicPackages.map(async (entry) => ({
    ...entry,
    manifest: JSON.parse(
      await readFile(resolve(repositoryRoot, entry.directory, 'package.json'), 'utf8'),
    ) as Manifest,
  })),
)
const version = validateManifests()

switch (process.argv[2]) {
  case 'build':
    buildPackages()
    break
  case 'pack':
    await packPackages()
    break
  case 'publish':
    validateReleaseTag()
    publishPackages()
    break
  case 'verify-local':
    await verifyLocalPackages()
    break
  case 'verify-published':
    validateReleaseTag()
    await verifyPublishedPackages()
    break
  case 'version':
    console.log(version)
    break
  default:
    throw new Error(
      'Expected one of: build, pack, publish, verify-local, verify-published, version',
    )
}

function validateManifests(): string {
  const versions = new Set(manifests.map(({ manifest }) => manifest.version))
  if (versions.size !== 1) throw new Error('Public Folio packages must use one coordinated version')

  for (const { manifest, name } of manifests) {
    if (manifest.name !== name) throw new Error(`${name} manifest name drifted to ${manifest.name}`)
    if (manifest.private === true) throw new Error(`${name} is still private`)
    if (manifest.publishConfig?.registry !== 'https://npm.pkg.github.com') {
      throw new Error(`${name} must publish only to GitHub Packages`)
    }
    if (!manifest.files?.includes('LICENSE') || !manifest.files.includes('README.md')) {
      throw new Error(`${name} must ship its license and package README`)
    }
  }

  return manifests[0]!.manifest.version
}

function validateReleaseTag(): void {
  const tag = process.env.GITHUB_REF_NAME
  if (tag !== `v${version}`) {
    throw new Error(`Release tag ${String(tag)} does not match package version v${version}`)
  }
}

async function packPackages(): Promise<void> {
  await ensureEmptyArtifactDirectory()
  buildPackages()

  for (const { directory, name } of publicPackages) {
    const filename = `${name.slice(1).replace('/', '-')}-${version}.tgz`
    run(
      'bun',
      ['pm', 'pack', '--destination', artifactDirectory, '--quiet'],
      resolve(repositoryRoot, directory),
    )
    inspectTarball(resolve(artifactDirectory, filename), name)
  }
}

function buildPackages(): void {
  run('vp', ['pack'], resolve(repositoryRoot, 'packages/resources'))
  run('vp', ['pack'], resolve(repositoryRoot, 'packages/vite'))
}

async function ensureEmptyArtifactDirectory(): Promise<void> {
  await mkdir(artifactDirectory, { recursive: true })
  const existing = await readdir(artifactDirectory)
  if (existing.length > 0) {
    throw new Error(`${artifactDirectory} must be empty before packing`)
  }
}

function inspectTarball(path: string, expectedName: string): void {
  const files = capture('tar', ['-tzf', path], repositoryRoot).trim().split('\n')
  if (files.some((file) => file.includes('.test.') || file.includes('test-fixtures'))) {
    throw new Error(`${basename(path)} contains test-only files`)
  }
  for (const required of ['package/LICENSE', 'package/README.md', 'package/package.json']) {
    if (!files.includes(required)) throw new Error(`${basename(path)} is missing ${required}`)
  }

  const packedManifest = JSON.parse(
    capture('tar', ['-xOf', path, 'package/package.json'], repositoryRoot),
  ) as Manifest
  if (packedManifest.name !== expectedName || packedManifest.version !== version) {
    throw new Error(`${basename(path)} identity does not match ${expectedName}@${version}`)
  }
  if (
    Object.values(packedManifest.dependencies ?? {}).some((specifier) =>
      specifier.startsWith('workspace:'),
    )
  ) {
    throw new Error(`${basename(path)} leaked a workspace dependency specifier`)
  }
}

function publishPackages(): void {
  for (const { name } of manifests) {
    console.log(`Publishing ${name}@${version}`)
    const tarball = resolve(artifactDirectory, `${name.slice(1).replace('/', '-')}-${version}.tgz`)
    inspectTarball(tarball, name)
    run('bun', ['publish', tarball, '--registry', 'https://npm.pkg.github.com'], repositoryRoot)
  }
}

async function verifyLocalPackages(): Promise<void> {
  const files = await readdir(artifactDirectory).catch(() => [])
  if (files.length === 0) throw new Error('Run packages.ts pack before verify-local')
  for (const { name } of publicPackages) {
    const filename = `${name.slice(1).replace('/', '-')}-${version}.tgz`
    inspectTarball(resolve(artifactDirectory, filename), name)
  }

  await verifyConsumer(
    publicPackages.map(({ name }) =>
      resolve(artifactDirectory, `${name.slice(1).replace('/', '-')}-${version}.tgz`),
    ),
    undefined,
    true,
  )
}

async function verifyPublishedPackages(): Promise<void> {
  if (!process.env.NPM_CONFIG_TOKEN) {
    throw new Error('NPM_CONFIG_TOKEN is required to verify GitHub Packages')
  }
  await verifyConsumer(
    publicPackages.map(({ name }) => `${name}@${version}`),
    [
      `@celados:registry=https://npm.pkg.github.com`,
      '//npm.pkg.github.com/:_authToken=${NPM_CONFIG_TOKEN}',
    ].join('\n'),
  )
}

async function verifyConsumer(
  packageSpecifiers: readonly string[],
  npmrc?: string,
  installSequentially = false,
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), 'folio-consumer-'))
  try {
    await writeConsumer(directory)
    if (npmrc) await writeFile(join(directory, '.npmrc'), `${npmrc}\n`)
    run(
      'bun',
      ['add', 'ripple', 'react', 'react-dom', '@duckdb/node-api', '@ripple-ts/vite-plugin', 'vite'],
      directory,
    )
    if (installSequentially) {
      // Exact tarball extraction proves package contents without teaching Bun a fake local registry.
      await extractLocalPackages(directory, packageSpecifiers)
    } else {
      run('bun', ['add', ...packageSpecifiers], directory)
    }
    run('bun', ['run', 'build'], directory)
  } finally {
    await rm(directory, { force: true, recursive: true })
  }
}

async function extractLocalPackages(
  consumerDirectory: string,
  packageSpecifiers: readonly string[],
): Promise<void> {
  const scopeDirectory = join(consumerDirectory, 'node_modules/@celados')
  await mkdir(scopeDirectory, { recursive: true })
  for (const [index, path] of packageSpecifiers.entries()) {
    const name = publicPackages[index]?.name
    if (!name) throw new Error(`No public package identity for ${path}`)
    const target = join(scopeDirectory, name.slice('@celados/'.length))
    await mkdir(target, { recursive: true })
    run('tar', ['-xzf', path, '-C', target, '--strip-components=1'], consumerDirectory)
  }
}

async function writeConsumer(directory: string): Promise<void> {
  await mkdir(join(directory, 'src'), { recursive: true })
  await Promise.all([
    writeFile(
      join(directory, 'package.json'),
      `${JSON.stringify(
        {
          name: 'folio-release-consumer',
          private: true,
          scripts: { build: 'vite build' },
          type: 'module',
        },
        null,
        2,
      )}\n`,
    ),
    writeFile(
      join(directory, 'index.html'),
      '<!doctype html><html><body><div id="app"></div><script type="module" src="/src/main.tsx"></script></body></html>\n',
    ),
    writeFile(
      join(directory, 'vite.config.ts'),
      [
        "import { folio } from '@celados/folio-vite'",
        "import { defineConfig } from 'vite'",
        '',
        'export default defineConfig({ plugins: folio() })',
        '',
      ].join('\n'),
    ),
    writeFile(join(directory, 'src', 'cities.csv'), 'city,trips\nBerlin,50\nLisbon,40\n'),
    writeFile(
      join(directory, 'src', 'cities.resource.ts'),
      [
        "import { defineSqlResource } from '@celados/folio-resources'",
        '',
        'export type CityRow = { city: string; trips: number }',
        '',
        'export const cities = defineSqlResource<CityRow>({',
        "  adapter: 'duckdb',",
        "  inputs: { cities: './cities.csv' },",
        "  query: 'select city, trips from cities order by trips desc',",
        '})',
        '',
      ].join('\n'),
    ),
    writeFile(
      join(directory, 'src', 'report.tsrx'),
      [
        "import { DataTable, Inspector } from '@celados/folio-ui'",
        "import { cities, type CityRow } from './cities.resource.ts'",
        '',
        'export function ReleaseConsumer() @{',
        '  <main>',
        '    <h1>Folio release consumer</h1>',
        '    <DataTable',
        '      caption="Trips by city"',
        '      columns={[',
        "        { label: 'City', value: (row: CityRow) => row.city },",
        "        { align: 'right', label: 'Trips', value: (row: CityRow) => String(row.trips) },",
        '      ]}',
        '      rows={cities.data}',
        '      rowKey={(row) => row.city}',
        '    />',
        '    <Inspector label="Provenance" value={cities.provenance} />',
        '  </main>',
        '}',
        '',
      ].join('\n'),
    ),
    writeFile(
      join(directory, 'src', 'main.tsx'),
      [
        "import { Mount } from '@celados/folio-react'",
        "import { createRoot } from 'react-dom/client'",
        "import { createElement } from 'react'",
        "import { ReleaseConsumer } from './report.tsrx'",
        '',
        "const target = document.querySelector<HTMLElement>('#app')",
        "if (target === null) throw new Error('Missing app target')",
        'createRoot(target).render(createElement(Mount, { component: ReleaseConsumer, initialProps: {} }))',
        '',
      ].join('\n'),
    ),
  ])
}

function capture(command: string, args: readonly string[], cwd: string): string {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stderr}`)
  }
  return result.stdout
}

function run(command: string, args: readonly string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' })
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed`)
}
