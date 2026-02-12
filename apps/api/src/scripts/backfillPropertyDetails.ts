import { getDb, closeDb, offers, propertyDetails } from '@bidradar/db'
import { parseDescription } from '@bidradar/core'
import { count } from 'drizzle-orm'

const BATCH_SIZE = 500

async function main() {
  const db = getDb()

  const result = await db.select({ total: count() }).from(offers)
  const total = result[0]?.total ?? 0
  console.log(`Total offers: ${total}`)

  let offset = 0
  let upserted = 0

  while (offset < total) {
    const batch = await db
      .select({ id: offers.id, description: offers.description })
      .from(offers)
      .limit(BATCH_SIZE)
      .offset(offset)

    if (batch.length === 0) break

    const rows = batch.map((row) => {
      const details = parseDescription(row.description)
      return {
        offerId: row.id,
        totalArea:
          details.totalArea !== null ? String(details.totalArea) : null,
        privateArea:
          details.privateArea !== null ? String(details.privateArea) : null,
        landArea:
          details.landArea !== null ? String(details.landArea) : null,
        bedrooms: details.bedrooms,
        bathrooms: details.bathrooms,
        livingRooms: details.livingRooms,
        kitchens: details.kitchens,
        garageSpaces: details.garageSpaces,
        hasServiceArea: details.hasServiceArea,
      }
    })

    for (const row of rows) {
      await db
        .insert(propertyDetails)
        .values(row)
        .onConflictDoUpdate({
          target: propertyDetails.offerId,
          set: row,
        })
    }

    upserted += batch.length
    offset += BATCH_SIZE
    console.log(`Progress: ${upserted}/${total}`)
  }

  console.log(`Backfill complete: ${upserted} records processed`)
  await closeDb()
}

main().catch((err) => {
  console.error('Backfill failed:', err)
  process.exit(1)
})
