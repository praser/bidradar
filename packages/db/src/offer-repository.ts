import type { Offer, OfferRepository } from '@bidradar/core'
import { parseDescription } from '@bidradar/core'
import { getDb } from './connection.js'
import { offers, propertyDetails, type OfferRow } from './schema.js'
import { eq, and, ne, inArray, sql, desc } from 'drizzle-orm'

function offerToRow(
  offer: Offer,
  params: { version: number; operation: string; downloadId: string },
) {
  return {
    sourceId: offer.id,
    uf: offer.uf,
    city: offer.city,
    neighborhood: offer.neighborhood,
    address: offer.address,
    askingPrice: String(offer.askingPrice),
    evaluationPrice: String(offer.evaluationPrice),
    discountPercent: String(offer.discountPercent),
    description: offer.description,
    propertyType: offer.propertyType,
    sellingType: offer.sellingType,
    offerUrl: offer.offerUrl,
    version: params.version,
    operation: params.operation,
    downloadId: params.downloadId,
  }
}

function num(val: string | number): number {
  return typeof val === 'string' ? Number(val) : val
}

function offerEquals(row: OfferRow, offer: Offer): boolean {
  return (
    row.sourceId === offer.id &&
    row.uf === offer.uf &&
    row.city === offer.city &&
    row.neighborhood === offer.neighborhood &&
    row.address === offer.address &&
    num(row.askingPrice) === offer.askingPrice &&
    num(row.evaluationPrice) === offer.evaluationPrice &&
    num(row.discountPercent) === offer.discountPercent &&
    row.description === offer.description &&
    row.propertyType === offer.propertyType &&
    row.sellingType === offer.sellingType &&
    row.offerUrl === offer.offerUrl
  )
}

function toPropertyDetailsRow(offerId: string, offer: Offer) {
  const details = parseDescription(offer.description)
  return {
    offerId,
    totalArea: details.totalArea !== null ? String(details.totalArea) : null,
    privateArea:
      details.privateArea !== null ? String(details.privateArea) : null,
    landArea: details.landArea !== null ? String(details.landArea) : null,
    bedrooms: details.bedrooms,
    bathrooms: details.bathrooms,
    livingRooms: details.livingRooms,
    kitchens: details.kitchens,
    garageSpaces: details.garageSpaces,
    hasServiceArea: details.hasServiceArea,
  }
}

const CHUNK_SIZE = 5000
// PostgreSQL supports max 65,535 parameters per query.
// Offers have 15 params per row; property details have 10.
// floor(65535 / 15) = 4369 — use 1000 for comfortable headroom.
const INSERT_CHUNK_SIZE = 1000

export function createOfferRepository(): OfferRepository {
  const db = getDb()

  return {
    async findExistingOffers(offersList) {
      const sourceIds = offersList.map((o) => o.id)
      if (sourceIds.length === 0) return new Map()

      const offerMap = new Map(offersList.map((o) => [o.id, o]))
      const result = new Map<
        string,
        { latestVersion: number; isActive: boolean; changed: boolean }
      >()

      for (let i = 0; i < sourceIds.length; i += CHUNK_SIZE) {
        const chunk = sourceIds.slice(i, i + CHUNK_SIZE)
        // DISTINCT ON (source_id) ... ORDER BY source_id, version DESC
        // gives us the latest version row per sourceId
        const rows = await db
          .selectDistinctOn([offers.sourceId])
          .from(offers)
          .where(inArray(offers.sourceId, chunk))
          .orderBy(offers.sourceId, desc(offers.version))

        for (const row of rows) {
          const offer = offerMap.get(row.sourceId)
          if (offer !== undefined) {
            result.set(row.sourceId, {
              latestVersion: row.version,
              isActive: row.operation !== 'delete',
              changed: row.operation === 'delete' || !offerEquals(row, offer),
            })
          }
        }
      }

      return result
    },

    async insertVersions(entries, downloadId) {
      if (entries.length === 0) return

      for (let i = 0; i < entries.length; i += INSERT_CHUNK_SIZE) {
        const chunk = entries.slice(i, i + INSERT_CHUNK_SIZE)
        const rows = chunk.map((e) =>
          offerToRow(e.offer, {
            version: e.version,
            operation: e.operation,
            downloadId,
          }),
        )
        const inserted = await db
          .insert(offers)
          .values(rows)
          .returning({ id: offers.id, sourceId: offers.sourceId })

        if (inserted.length > 0) {
          const entryMap = new Map(chunk.map((e) => [e.offer.id, e.offer]))
          const pdRows = inserted
            .map((row) => {
              const offer = entryMap.get(row.sourceId)
              if (offer === undefined) return null
              return toPropertyDetailsRow(row.id, offer)
            })
            .filter((r) => r !== null)

          if (pdRows.length > 0) {
            await db
              .insert(propertyDetails)
              .values(pdRows)
              .onConflictDoUpdate({
                target: propertyDetails.offerId,
                set: {
                  totalArea: sql`excluded.total_area`,
                  privateArea: sql`excluded.private_area`,
                  landArea: sql`excluded.land_area`,
                  bedrooms: sql`excluded.bedrooms`,
                  bathrooms: sql`excluded.bathrooms`,
                  livingRooms: sql`excluded.living_rooms`,
                  kitchens: sql`excluded.kitchens`,
                  garageSpaces: sql`excluded.garage_spaces`,
                  hasServiceArea: sql`excluded.has_service_area`,
                },
              })
          }
        }
      }
    },

    async insertDeleteVersions(uf, activeSourceIds, downloadId) {
      if (activeSourceIds.size === 0) return 0

      // Find latest active version per sourceId in this UF
      const latestRows = await db
        .selectDistinctOn([offers.sourceId])
        .from(offers)
        .where(and(eq(offers.uf, uf), ne(offers.operation, 'delete')))
        .orderBy(offers.sourceId, desc(offers.version))

      // Filter to those not in activeSourceIds (missing from this download)
      const toDelete = latestRows.filter(
        (r) => !activeSourceIds.has(r.sourceId),
      )

      if (toDelete.length === 0) return 0

      // Insert delete version rows
      let totalDeleted = 0
      for (let i = 0; i < toDelete.length; i += INSERT_CHUNK_SIZE) {
        const chunk = toDelete.slice(i, i + INSERT_CHUNK_SIZE)
        const rows = chunk.map((row) => ({
          sourceId: row.sourceId,
          uf: row.uf,
          city: row.city,
          neighborhood: row.neighborhood,
          address: row.address,
          askingPrice: row.askingPrice,
          evaluationPrice: row.evaluationPrice,
          discountPercent: row.discountPercent,
          description: row.description,
          propertyType: row.propertyType,
          sellingType: row.sellingType,
          offerUrl: row.offerUrl,
          version: row.version + 1,
          operation: 'delete',
          downloadId,
        }))

        const inserted = await db
          .insert(offers)
          .values(rows)
          .returning({ id: offers.id })
        totalDeleted += inserted.length
      }

      return totalDeleted
    },
  }
}
