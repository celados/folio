import { defineSqlResource } from '@celados/folio-resources'

const invalid = defineSqlResource({ adapter: 'duckdb', query: 'select 1' })

export default invalid
