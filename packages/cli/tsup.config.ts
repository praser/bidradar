import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist/bin',
  format: 'esm',
  target: 'node22',
  platform: 'node',
  bundle: true,
  noExternal: [/.*/],
  clean: true,
  banner: {
    js: [
      '#!/usr/bin/env node',
      'import { createRequire } from "node:module";',
      'const require = createRequire(import.meta.url);',
    ].join('\n'),
  },
})
