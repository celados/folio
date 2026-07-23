import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    dts: true,
    entry: ['src/index.ts', 'src/internal.ts'],
    format: ['esm'],
    sourcemap: true,
  },
})
