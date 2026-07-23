import { resolve } from 'node:path'

import type { Plugin } from 'vite'

import { compileResourceModule } from './compiler.ts'

const VIRTUAL_RESOURCE_PREFIX = 'virtual:folio-resource/'
const RESOLVED_RESOURCE_PREFIX = `\0${VIRTUAL_RESOURCE_PREFIX}`

export type ResourceModulesOptions = Readonly<{
  cacheDirectory?: string
  refresh?: boolean
}>

export function resourceModules(options: ResourceModulesOptions = {}): Plugin {
  let root = process.cwd()
  let cacheDirectory = resolve(root, '.folio/cache')
  const refreshedModules = new Set<string>()
  const artifacts = new Map<string, string>()

  return {
    name: 'folio:resources',
    enforce: 'pre',
    configResolved(config) {
      root = config.root
      cacheDirectory = resolve(root, options.cacheDirectory ?? '.folio/cache')
    },
    resolveId(id) {
      if (id.startsWith(VIRTUAL_RESOURCE_PREFIX)) return `\0${id}`
      return undefined
    },
    load(id) {
      if (!id.startsWith(RESOLVED_RESOURCE_PREFIX)) return undefined
      const code = artifacts.get(id.slice(1))
      if (code === undefined) this.error(`[folio:resource] Unknown artifact module ${id.slice(1)}`)
      return code
    },
    async transform(source, id) {
      const moduleId = id.split('?', 1)[0]
      if (!moduleId?.endsWith('.resource.ts')) return undefined

      try {
        const compiled = await compileResourceModule({
          cacheDirectory,
          id,
          // Multi-environment builds transform the same module more than once; one explicit refresh
          // should not execute an identical query independently for client and SSR.
          refresh: (options.refresh ?? false) && !refreshedModules.has(moduleId),
          root,
          source,
        })
        artifacts.set(compiled.artifact.specifier, compiled.artifact.code)
        refreshedModules.add(moduleId)
        for (const watchFile of compiled.watchFiles) this.addWatchFile(watchFile)
        return { code: compiled.code, map: null }
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error)
        this.error(`[folio:resource] ${id}: ${detail}`)
      }
    },
  }
}
