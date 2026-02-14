import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { offers, users, propertyDetails, authSessions } from '../packages/db/src/schema.js'
import { sql } from 'drizzle-orm'

const connectionString =
  process.env.DATABASE_URL ?? 'postgresql://imoveis:imoveis@localhost:5432/imoveis'

let client: ReturnType<typeof postgres> | null = null

function getClient() {
  if (client === null) {
    client = postgres(connectionString, { connection: { TimeZone: 'UTC' } })
  }
  return client
}

export function getTestDb() {
  return drizzle({ client: getClient() })
}

export async function cleanDatabase() {
  const db = getTestDb()
  await db.delete(propertyDetails)
  await db.delete(authSessions)
  await db.delete(offers)
  await db.delete(users)
}

export async function seedOffers(count: number = 3) {
  const db = getTestDb()
  const rows = Array.from({ length: count }, (_, i) => ({
    sourceId: `test-offer-${String(i + 1)}`,
    uf: i % 2 === 0 ? 'DF' : 'SP',
    city: i % 2 === 0 ? 'Brasilia' : 'Sao Paulo',
    neighborhood: `Neighborhood ${String(i + 1)}`,
    address: `Street ${String(i + 1)}, ${String(100 + i)}`,
    askingPrice: String(100000 + i * 50000),
    evaluationPrice: String(120000 + i * 50000),
    discountPercent: String(10 + i),
    description: `Test offer ${String(i + 1)} - Apartamento com ${String(2 + i)} quartos`,
    propertyType: 'Apartamento',
    sellingType: 'Licitacao Aberta',
    offerUrl: `https://example.com/offers/${String(i + 1)}`,
    version: 1,
    operation: 'insert',
    createdAt: new Date(),
  }))

  return db.insert(offers).values(rows).returning()
}

export async function seedUser(data: {
  email: string
  name: string
  googleId: string
  role: 'admin' | 'free'
}) {
  const db = getTestDb()
  const [user] = await db.insert(users).values(data).returning()
  return user!
}

export async function closeTestDb() {
  if (client !== null) {
    await client.end()
    client = null
  }
}

export async function verifyDatabaseConnection(): Promise<boolean> {
  try {
    const db = getTestDb()
    await db.execute(sql`SELECT 1`)
    return true
  } catch {
    return false
  }
}
