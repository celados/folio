import { defineSqlResource } from '@celados/folio-resources'

const aggregate = (input: string) => `
  select
    source,
    cast(sum(value) as integer) as total,
    bool_or(active) as active
  from ${input}
  group by source
`

export const jsonlEvents = defineSqlResource({
  adapter: 'duckdb',
  inputs: { events: './events.jsonl' },
  query: aggregate('events'),
})

export const ndjsonEvents = defineSqlResource({
  adapter: 'duckdb',
  inputs: { events: './events.ndjson' },
  query: aggregate('events'),
})

export const parquetEvents = defineSqlResource({
  adapter: 'duckdb',
  inputs: { events: './events.parquet' },
  query: aggregate('events'),
})
