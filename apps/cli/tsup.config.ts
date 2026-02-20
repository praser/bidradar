import { readFileSync } from 'node:fs'
import { defineConfig } from 'tsup'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist/bin',
  format: 'esm',
  target: 'node22',
  platform: 'node',
  bundle: true,
  splitting: false,
  noExternal: [/.*/],
  clean: true,
  define: {
    __CLI_VERSION__: JSON.stringify(pkg.version),
  },
  env: {
    BIDRADAR_API_URL: process.env.BIDRADAR_API_URL ?? 'http://localhost:3000',
  },
  banner: {
    js: [
      '#!/usr/bin/env node',
      'import { createRequire } from "node:module";',
      'const require = createRequire(import.meta.url);',
    ].join('\n'),
  },
})
