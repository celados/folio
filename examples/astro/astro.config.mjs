// @ts-check

import { folio } from '@celados/folio-vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  // The acceptance Host has no toolbar integration surface; disabling it also keeps HMR evidence
  // independent of Astro's separately optimized dev-only client.
  devToolbar: {
    enabled: false,
  },
  vite: {
    plugins: folio(),
  },
})
