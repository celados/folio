import { defineSqlResource } from '@celados/folio-resources'

export const broken = defineSqlResource({
  adapter: 'duckdb',
  query: 'select * from a_table_that_does_not_exist',
})
