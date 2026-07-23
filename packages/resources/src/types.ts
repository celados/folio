export type ResourceColumnType =
  | 'array'
  | 'bigint'
  | 'binary'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'integer'
  | 'number'
  | 'object'
  | 'string'
  | 'unknown'

export type ResourceColumn = Readonly<{
  name: string
  type: ResourceColumnType
}>

export type ResourceInputProvenance = Readonly<{
  hash: string
  name: string
  specifier: string
}>

export type ResourceProvenance = Readonly<{
  adapter: Readonly<{
    name: string
    version: string
  }>
  artifactFormatVersion: number
  artifactHash: string
  cacheKey: string
  declarationHash: string
  inputs: readonly ResourceInputProvenance[]
  kind: 'sql'
  module: string
  resource: string
}>

export type Resource<T> = Readonly<{
  data: readonly T[]
  provenance: ResourceProvenance
  schema: readonly ResourceColumn[]
}>

export type SqlParameter = boolean | null | number | string

export type SqlResourceConfig = Readonly<{
  adapter: 'duckdb'
  inputs?: Readonly<Record<string, string>>
  parameters?: readonly SqlParameter[]
  query: string
}>
