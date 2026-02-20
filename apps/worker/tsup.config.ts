import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: 'esm',
  target: 'node22',
  platform: 'node',
  bundle: true,
  splitting: false,
  noExternal: [/.*/],
  clean: true,
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
})
