import { ripple, type RipplePluginOptions } from '@ripple-ts/vite-plugin'
import type { PluginOption } from 'vite'

import { resourceModules, type ResourceModulesOptions } from './plugin.ts'

export type FolioPluginOptions = Readonly<{
  resources?: ResourceModulesOptions
  ripple?: RipplePluginOptions
}>

export function folio(options: FolioPluginOptions = {}): PluginOption[] {
  return [
    resourceModules(options.resources),
    ...ripple({
      // Folio runs inside another framework; package-wide exclusion can split Host runtimes such
      // as React between optimized and native module graphs after SSR dependency discovery.
      excludeRippleExternalModules: true,
      ...options.ripple,
    }),
  ]
}

export { resourceModules }
export type { ResourceModulesOptions }
