import { ripple } from '@ripple-ts/vite-plugin'
import { defineConfig } from 'vite-plus'

const config = defineConfig({
  fmt: {
    semi: false,
    singleQuote: true,
  },
  lint: {
    plugins: ['typescript', 'react'],
  },
  plugins: [ripple()],
  resolve: {
    // Mount tests exercise the browser runtime; Ripple's default condition is server-only.
    conditions: ['browser'],
  },
  test: {
    environment: 'jsdom',
    include: ['packages/**/*.test.ts', 'packages/**/*.test.tsx'],
  },
})

export default config
