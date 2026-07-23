// @vitest-environment node

import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { build } from 'vite'

import { resourceModules } from './plugin.ts'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const fixture = join(repositoryRoot, 'packages/vite/src/test-fixtures/trips.resource.ts')

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
})
