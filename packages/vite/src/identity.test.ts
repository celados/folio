// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { resourceCacheKey } from './identity.ts'
import type { ResolvedSqlResource } from './model.ts'

describe('resourceCacheKey', () => {
  it('invalidates every result-bearing input', () => {
    const baseline = resource()
    const keys = [
      resourceCacheKey(baseline, 'adapter-1'),
      resourceCacheKey({ ...baseline, query: 'select 2' }, 'adapter-1'),
      resourceCacheKey({ ...baseline, parameters: [2] }, 'adapter-1'),
      resourceCacheKey({ ...baseline, declarationHash: 'declaration-2' }, 'adapter-1'),
      resourceCacheKey(
        {
          ...baseline,
          inputs: [{ ...baseline.inputs[0]!, hash: 'input-2' }],
        },
        'adapter-1',
      ),
      resourceCacheKey(baseline, 'adapter-2'),
    ]

    expect(new Set(keys).size).toBe(keys.length)
  })
})

function resource(): ResolvedSqlResource {
  return {
    adapter: 'duckdb',
    declarationHash: 'declaration-1',
    inputs: [
      { hash: 'input-1', name: 'trips', path: '/workspace/trips.csv', specifier: './trips.csv' },
    ],
    module: 'src/trips.resource.ts',
    parameters: [1],
    query: 'select 1',
    resource: 'trips',
  }
}
