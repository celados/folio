import { hash, stableStringify } from './hash.ts'
import { ARTIFACT_FORMAT_VERSION, type ResolvedSqlResource } from './model.ts'

export function resourceCacheKey(resource: ResolvedSqlResource, adapterVersion: string): string {
  return hash(
    stableStringify({
      adapter: { name: resource.adapter, version: adapterVersion },
      artifactFormatVersion: ARTIFACT_FORMAT_VERSION,
      declarationHash: resource.declarationHash,
      inputs: resource.inputs.map(({ hash: inputHash, name, specifier }) => ({
        hash: inputHash,
        name,
        specifier,
      })),
      kind: 'sql',
      module: resource.module,
      parameters: resource.parameters,
      query: resource.query,
      resource: resource.resource,
    }),
  )
}
