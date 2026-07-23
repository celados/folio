import type { Resource, SqlResourceConfig } from './types.ts'

const RESOURCE_DECLARATION = Symbol.for('@celados/folio-resources/declaration')

export type SqlResourceDeclaration = Readonly<{
  [RESOURCE_DECLARATION]: true
  config: SqlResourceConfig
  kind: 'sql'
}>

export function defineSqlResource<T>(config: SqlResourceConfig): Resource<T> {
  return Object.freeze({
    [RESOURCE_DECLARATION]: true,
    config: Object.freeze(config),
    kind: 'sql',
  }) as unknown as Resource<T>
}

export function readResourceDeclaration(value: unknown): SqlResourceDeclaration | undefined {
  if (typeof value !== 'object' || value === null) return undefined

  const candidate = value as Partial<SqlResourceDeclaration>
  if (candidate[RESOURCE_DECLARATION] !== true || candidate.kind !== 'sql') return undefined
  return candidate as SqlResourceDeclaration
}
