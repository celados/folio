import { folio } from '@celados/folio-vite'
import { defineConfig } from 'vite-plus'

const config = defineConfig({
  fmt: {
    // Resource inputs are provenance-bearing source bytes, not authored config files.
    ignorePatterns: [
      '.folio/**',
      '.trash/**',
      'examples/**/.astro/**',
      'examples/**/dist/**',
      'examples/**/src/resources/**/*.json',
      'examples/**/src/worker-configuration.d.ts',
      'test-results/**',
    ],
    semi: false,
    singleQuote: true,
  },
  lint: {
    ignorePatterns: [
      '.trash/**',
      'examples/**/.astro/**',
      'examples/**/dist/**',
      'test-results/**',
    ],
    plugins: ['typescript', 'react'],
  },
  plugins: folio(),
  resolve: {
    // Mount tests exercise the browser runtime; Ripple's default condition is server-only.
    conditions: ['browser'],
  },
  test: {
    environment: 'jsdom',
    include: ['examples/**/*.test.ts', 'packages/**/*.test.ts', 'packages/**/*.test.tsx'],
  },
})

export default config
