import { cloudflare } from '@cloudflare/vite-plugin'
import { folio } from '@celados/folio-vite'
import tailwindcss from '@tailwindcss/vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, lazyPlugins } from 'vite-plus'

import { oxfmtConfig } from './tooling/oxfmt'

const ROUTER_GEN_PATH = 'src/route-tree.gen.ts'
const isTest = process.env.VITEST === 'true'
const config = defineConfig({
  staged: {
    '*': 'vp check --fix',
  },
  // TanStack Router regenerates this file with Prettier, so checking it with
  // Oxfmt would create permanent build/check drift.
  lint: { ignorePatterns: [ROUTER_GEN_PATH] },
  fmt: {
    ...oxfmtConfig,
    sortTailwindcss: {
      stylesheet: 'src/styles.css',
      functions: ['cn', 'cx', 'clsx', 'cva'],
    },
  },
  resolve: {
    // Host adapters must share the renderer's React module even when the package is linked source.
    dedupe: ['react', 'react-dom'],
    tsconfigPaths: true,
  },
  plugins: lazyPlugins(() => [
    // Cloudflare must own Start's SSR environment so development and builds
    // execute against the Workers runtime: https://developers.cloudflare.com/workers/vite-plugin/reference/vite-environments/
    ...(!isTest ? [cloudflare({ viteEnvironment: { name: 'ssr' } })] : []),
    devtools(),
    tailwindcss(),
    ...folio(),
    tanstackStart({
      router: {
        generatedRouteTree: 'route-tree.gen.ts',
      },
    }),
    viteReact(),
  ]),
})

export default config
