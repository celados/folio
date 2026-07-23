// @vitest-environment node

import { describe, expect, expectTypeOf, it } from 'vitest'

import { defineSqlResource, type Resource } from './index.ts'
import { readResourceDeclaration } from './internal.ts'

type Row = { city: string; trips: number }

describe('defineSqlResource', () => {
  it('presents a Resource to authors and a declaration to the build pipeline', () => {
    const resource = defineSqlResource<Row>({
      adapter: 'duckdb',
      query: 'select city, trips from mobility',
    })

    expectTypeOf(resource).toEqualTypeOf<Resource<Row>>()
    expect(readResourceDeclaration(resource)).toMatchObject({
      config: { adapter: 'duckdb', query: 'select city, trips from mobility' },
      kind: 'sql',
    })
    expect(Object.isFrozen(resource)).toBe(true)
  })
})
