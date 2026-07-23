import type {
  ResourceColumn,
  ResourceInputProvenance,
  ResourceProvenance,
  SqlParameter,
} from '@celados/folio-resources'

export const ARTIFACT_FORMAT_VERSION = 1

export type ResourceArtifact = Readonly<{
  data: readonly unknown[]
  schema: readonly ResourceColumn[]
}>

export type ResourceManifest = Readonly<{
  artifactHash: string
  formatVersion: typeof ARTIFACT_FORMAT_VERSION
  key: string
  provenance: ResourceProvenance
}>

export type ResolvedInput = ResourceInputProvenance &
  Readonly<{
    path: string
  }>

export type ResolvedSqlResource = Readonly<{
  adapter: 'duckdb'
  declarationHash: string
  inputs: readonly ResolvedInput[]
  module: string
  parameters: readonly SqlParameter[]
  query: string
  resource: string
}>

export type MaterializedResource = Readonly<{
  artifact: ResourceArtifact
  manifest: ResourceManifest
}>
