import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig } from 'drizzle-kit'

// drizzle-kit looks for .env in cwd (packages/db), but ours is at the monorepo root
if (!process.env.DATABASE_URL) {
  const envPath = resolve(process.cwd(), '../../.env')
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.+)$/)
    if (match) {
      process.env[match[1]] ??= match[2]
    }
  }
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
