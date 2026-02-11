import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['index.ts'],
  outDir: 'dist/bin',
  format: 'esm',
  target: 'node22',
  bundle: true,
  clean: true,
  banner: { js: '#!/usr/bin/env node' },
})
