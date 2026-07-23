// @vitest-environment node

import { resolve } from 'node:path'

import { folio } from '@celados/folio-vite'
import { afterEach, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'

let server: ViteDevServer | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
})

describe('mount SSR boundary', () => {
  it('imports safely but rejects DOM mounting in Vite SSR', async () => {
    const root = resolve(import.meta.dirname, '../../..')
    server = await createServer({
      configFile: false,
      logLevel: 'silent',
      plugins: [folio()],
      root,
      server: { middlewareMode: true },
    })

    const module = (await server.ssrLoadModule('/packages/core/src/mount.ts')) as {
      mount(options: {
        component: (props: Record<string, never>) => void
        initialProps: Record<string, never>
        target: HTMLElement
      }): () => void
    }

    expect(() =>
      module.mount({
        component: () => undefined,
        initialProps: {},
        target: {} as HTMLElement,
      }),
    ).toThrow('@celados/folio mount() is unavailable during SSR')
  })
})
