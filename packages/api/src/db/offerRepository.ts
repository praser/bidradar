import type { Offer } from '@bidradar/shared'
import type { OfferRepository } from '../core/offerRepository.js'
import { getDb, offers, type OfferRow } from './index.js'
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
    row.sellingType === offer.sellingType &&
    row.offerUrl === offer.offerUrl
  )
}

export function createOfferRepository(): OfferRepository {
  const db = getDb()

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
      await db.insert(offers).values(offerToRow(offer))
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
