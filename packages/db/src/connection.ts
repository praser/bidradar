import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://imoveis:imoveis@localhost:5432/imoveis'

let client: ReturnType<typeof postgres> | null = null

function getClient() {
  if (client === null) {
    client = postgres(connectionString, {
      connection: { TimeZone: 'UTC' },
    })
  }
  return client
}

export function getDb() {
  return drizzle({ client: getClient(), schema })
}

export async function closeDb(): Promise<void> {
  if (client !== null) {
    await client.end()
    client = null
  }
}

export function getRawClient() {
  return getClient()
}
