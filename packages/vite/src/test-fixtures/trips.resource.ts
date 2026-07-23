import { defineSqlResource } from '@celados/folio-resources'

import { query } from './query.ts'

export const trips = defineSqlResource<{ city: string; trips: number }>({
  adapter: 'duckdb',
  inputs: { trips: './trips.csv' },
  parameters: [10],
  query,
})
