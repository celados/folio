import { defineConfig } from 'vite-plus'

export default defineConfig({
  pack: {
    dts: true,
    entry: [
      'src/index.ts',
      'src/internal.ts',
      'src/readers/arrow.ts',
      'src/readers/arquero.ts',
      'src/readers/parquet.ts',
      'src/readers/xlsx.ts',
      'src/readers/zip.ts',
    ],
    format: ['esm'],
    sourcemap: true,
  },
})
