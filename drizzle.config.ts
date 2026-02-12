import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './packages/api/src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ??
      'postgresql://imoveis:imoveis@localhost:5432/imoveis',
  },
})
