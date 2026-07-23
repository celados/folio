import { extname } from 'node:path'

import type { ResourceColumnType } from '@celados/folio-resources'
import type { DuckDBConnection, DuckDBTypeId, DuckDBValue } from '@duckdb/node-api'

import type { ResolvedSqlResource, ResourceArtifact } from './model.ts'

type DuckDb = typeof import('@duckdb/node-api')
type DuckDbImporter = () => Promise<DuckDb>

export type DuckDbAdapter = Readonly<{
  materialize(resource: ResolvedSqlResource): Promise<ResourceArtifact>
  version: string
}>

export async function loadDuckDbAdapter(
  importDuckDb: DuckDbImporter = () => import('@duckdb/node-api'),
): Promise<DuckDbAdapter> {
  let duckdb: DuckDb
  try {
    duckdb = await importDuckDb()
  } catch (error) {
    throw new Error(
      'DuckDB resources require @duckdb/node-api in the Host project. Install it as a development dependency.',
      { cause: error },
    )
  }

  return {
    materialize: (resource) => materializeWithDuckDb(duckdb, resource),
    // Both sides affect query results, so the cache identity covers our adapter contract and DuckDB itself.
    version: `folio-duckdb-1+duckdb-${duckdb.version()}`,
  }
}

async function materializeWithDuckDb(
  duckdb: DuckDb,
  resource: ResolvedSqlResource,
): Promise<ResourceArtifact> {
  const instance = await duckdb.DuckDBInstance.create(':memory:')
  let connection: DuckDBConnection | undefined

  try {
    connection = await instance.connect()
    for (const input of resource.inputs) {
      await connection.run(createInputViewSql(input.name, input.path))
    }

    const reader = await connection.runAndReadAll(
      resource.query,
      resource.parameters as DuckDBValue[],
    )

    return {
      data: reader.getRowObjectsJson(),
      schema: reader.columnNames().map((name, index) => ({
        name,
        type: normalizeColumnType(duckdb.DuckDBTypeId, reader.columnTypeId(index)),
      })),
    }
  } finally {
    try {
      connection?.disconnectSync()
    } finally {
      instance.closeSync()
    }
  }
}

function createInputViewSql(name: string, path: string): string {
  const source = sqlString(path)
  const reader = inputReader(extname(path).toLowerCase(), source)
  return `create temp view ${sqlIdentifier(name)} as select * from ${reader}`
}

function inputReader(extension: string, source: string): string {
  switch (extension) {
    case '.csv':
      return `read_csv_auto(${source}, header = true)`
    case '.json':
      return `read_json_auto(${source})`
    case '.jsonl':
    case '.ndjson':
      return `read_json_auto(${source}, format = 'newline_delimited')`
    case '.parquet':
      return `read_parquet(${source})`
    default:
      throw new Error(
        `Unsupported resource input format ${JSON.stringify(extension || '(none)')}; expected CSV, JSON, JSONL, NDJSON, or Parquet`,
      )
  }
}

function sqlIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function normalizeColumnType(
  typeIds: typeof DuckDBTypeId,
  typeId: DuckDBTypeId,
): ResourceColumnType {
  switch (typeId) {
    case typeIds.BOOLEAN:
      return 'boolean'
    case typeIds.TINYINT:
    case typeIds.SMALLINT:
    case typeIds.INTEGER:
    case typeIds.UTINYINT:
    case typeIds.USMALLINT:
    case typeIds.UINTEGER:
    case typeIds.INTEGER_LITERAL:
      return 'integer'
    case typeIds.BIGINT:
    case typeIds.UBIGINT:
    case typeIds.HUGEINT:
    case typeIds.UHUGEINT:
    case typeIds.BIGNUM:
      return 'bigint'
    case typeIds.FLOAT:
    case typeIds.DOUBLE:
    case typeIds.DECIMAL:
      return 'number'
    case typeIds.DATE:
      return 'date'
    case typeIds.TIMESTAMP:
    case typeIds.TIMESTAMP_S:
    case typeIds.TIMESTAMP_MS:
    case typeIds.TIMESTAMP_NS:
    case typeIds.TIMESTAMP_TZ:
      return 'datetime'
    case typeIds.VARCHAR:
    case typeIds.STRING_LITERAL:
    case typeIds.UUID:
    case typeIds.ENUM:
    case typeIds.BIT:
    case typeIds.TIME:
    case typeIds.TIME_NS:
    case typeIds.TIME_TZ:
    case typeIds.INTERVAL:
      return 'string'
    case typeIds.BLOB:
    case typeIds.GEOMETRY:
      return 'binary'
    case typeIds.LIST:
    case typeIds.ARRAY:
      return 'array'
    case typeIds.STRUCT:
    case typeIds.MAP:
    case typeIds.UNION:
    case typeIds.VARIANT:
      return 'object'
    default:
      return 'unknown'
  }
}
