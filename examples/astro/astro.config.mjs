// @ts-check

import { folio } from '@celados/folio-vite'
import { defineConfig } from 'astro/config'

export default defineConfig({
  vite: {
    plugins: folio(),
  },
})
