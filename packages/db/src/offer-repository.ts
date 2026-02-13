import type { Offer, OfferRepository } from '@bidradar/core'
import { parseDescription } from '@bidradar/core'
import { getDb } from './connection.js'
import { offers, propertyDetails, type OfferRow } from './schema.js'
import { eq, and, isNull, inArray, sql } from 'drizzle-orm'

const nowUTC = () => new Date()

function offerToRow(offer: Offer) {
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
    lastSeenAt: nowUTC(),
    removedAt: null,
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
// Offers have 14 params per row; property details have 10.
// floor(65535 / 14) = 4681 — use 1000 for comfortable headroom.
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
        { internalId: string; version: number; changed: boolean }
      >()

      for (let i = 0; i < sourceIds.length; i += CHUNK_SIZE) {
        const chunk = sourceIds.slice(i, i + CHUNK_SIZE)
        const rows = await db
          .select()
          .from(offers)
          .where(inArray(offers.sourceId, chunk))

        for (const row of rows) {
          const offer = offerMap.get(row.sourceId)
          if (offer !== undefined) {
            result.set(row.sourceId, {
              internalId: row.id,
              version: row.version,
              changed: !offerEquals(row, offer),
            })
          }
        }
      }

      return result
    },

    async insertMany(offersList) {
      if (offersList.length === 0) return

      for (let i = 0; i < offersList.length; i += INSERT_CHUNK_SIZE) {
        const chunk = offersList.slice(i, i + INSERT_CHUNK_SIZE)
        const rows = chunk.map(offerToRow)
        const inserted = await db
          .insert(offers)
          .values(rows)
          .returning({ id: offers.id, sourceId: offers.sourceId })

        if (inserted.length > 0) {
          const offerMap = new Map(chunk.map((o) => [o.id, o]))
          const pdRows = inserted
            .map((row) => {
              const offer = offerMap.get(row.sourceId)
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

    async updateMany(entries) {
      if (entries.length === 0) return

      await db.transaction(async (tx) => {
        for (const entry of entries) {
          const row = offerToRow(entry.offer)
          await tx
            .update(offers)
            .set({
              ...row,
              version: entry.version + 1,
              updatedAt: nowUTC(),
            })
            .where(eq(offers.id, entry.internalId))

          const pdRow = toPropertyDetailsRow(entry.internalId, entry.offer)
          await tx
            .insert(propertyDetails)
            .values(pdRow)
            .onConflictDoUpdate({
              target: propertyDetails.offerId,
              set: pdRow,
            })
        }
      })
    },

    async touchManyLastSeen(internalIds) {
      if (internalIds.length === 0) return

      const now = nowUTC()
      for (let i = 0; i < internalIds.length; i += CHUNK_SIZE) {
        const chunk = internalIds.slice(i, i + CHUNK_SIZE)
        await db
          .update(offers)
          .set({ lastSeenAt: now, removedAt: null })
          .where(inArray(offers.id, chunk))
      }
    },

    async softDeleteMissing(uf, activeSourceIds) {
      if (activeSourceIds.size === 0) return 0

      const existing = await db
        .select({ id: offers.id, sourceId: offers.sourceId })
        .from(offers)
        .where(and(eq(offers.uf, uf), isNull(offers.removedAt)))

      const toRemove = existing
        .filter((r) => !activeSourceIds.has(r.sourceId))
        .map((r) => r.id)

      if (toRemove.length === 0) return 0

      const now = nowUTC()
      let totalRemoved = 0
      for (let i = 0; i < toRemove.length; i += CHUNK_SIZE) {
        const chunk = toRemove.slice(i, i + CHUNK_SIZE)
        const removed = await db
          .update(offers)
          .set({ removedAt: now })
          .where(inArray(offers.id, chunk))
          .returning({ id: offers.id })
        totalRemoved += removed.length
      }
      return totalRemoved
    },
  }
}
