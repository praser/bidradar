import type { Offer, OfferRepository } from '@bidradar/core'
import { parseDescription } from '@bidradar/core'
import { createPropertyDetailsRepository } from './property-details-repository.js'
import { getDb } from './connection.js'
import { offers, type OfferRow } from './schema.js'
import { eq, and, notInArray, isNull } from 'drizzle-orm'

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

export function createOfferRepository(): OfferRepository {
  const db = getDb()
  const pdRepo = createPropertyDetailsRepository()

  return {
    async findBySourceId(sourceId, offer) {
      const [existing] = await db
        .select()
        .from(offers)
        .where(eq(offers.sourceId, sourceId))
        .limit(1)

      if (existing === undefined) return undefined

      return {
        internalId: existing.id,
        version: existing.version,
        changed: !offerEquals(existing, offer),
      }
    },

    async insertNew(offer) {
      const [inserted] = await db
        .insert(offers)
        .values(offerToRow(offer))
        .returning({ id: offers.id })
      if (inserted !== undefined) {
        await pdRepo.upsert(inserted.id, parseDescription(offer.description))
      }
    },

    async updateChanged(internalId, version, offer) {
      const row = offerToRow(offer)
      await db
        .update(offers)
        .set({
          ...row,
          version: version + 1,
          updatedAt: nowUTC(),
        })
        .where(eq(offers.id, internalId))
      await pdRepo.upsert(internalId, parseDescription(offer.description))
    },

    async touchLastSeen(internalId) {
      await db
        .update(offers)
        .set({ lastSeenAt: nowUTC(), removedAt: null })
        .where(eq(offers.id, internalId))
    },

    async softDeleteMissing(uf, activeSourceIds) {
      if (activeSourceIds.size === 0) return 0
      const removed = await db
        .update(offers)
        .set({ removedAt: nowUTC() })
        .where(
          and(
            eq(offers.uf, uf),
            notInArray(offers.sourceId, [...activeSourceIds]),
            isNull(offers.removedAt),
          ),
        )
        .returning({ id: offers.id })
      return removed.length
    },
  }
}
