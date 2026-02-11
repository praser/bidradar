import { getOffers } from './src/cef/index.js'
import { getDb, offers, closeDb, type OfferRow } from './src/db/index.js'
import type { Offer } from './src/core/types.js'
import { eq, and, notInArray, isNull } from 'drizzle-orm'

/** Current time in UTC (JS Date is epoch-based; DB session is set to UTC). */
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
    offerUrl: offer.offerUrl.toString(),
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
    row.offerUrl === offer.offerUrl.toString()
  )
}

async function persistOffers() {
  const db = getDb()
  const list = await getOffers()
  const seenSourceIds = new Set(list.map((o) => o.id))

  for (const offer of list) {
    const [existing] = await db
      .select()
      .from(offers)
      .where(eq(offers.sourceId, offer.id))
      .limit(1)

    if (existing === undefined) {
      await db.insert(offers).values(offerToRow(offer))
      continue
    }

    if (!offerEquals(existing, offer)) {
      const row = offerToRow(offer)
      await db
        .update(offers)
        .set({
          ...row,
          version: existing.version + 1,
          updatedAt: nowUTC(),
        })
        .where(eq(offers.id, existing.id))
    } else {
      await db
        .update(offers)
        .set({ lastSeenAt: nowUTC(), removedAt: null })
        .where(eq(offers.id, existing.id))
    }
  }

  if (seenSourceIds.size > 0) {
    await db
      .update(offers)
      .set({ removedAt: nowUTC() })
      .where(
        and(
          notInArray(offers.sourceId, [...seenSourceIds]),
          isNull(offers.removedAt),
        ),
      )
  }
}

persistOffers()
  .then(async () => {
    console.log('Done persisting offers.')
    await closeDb()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error(err)
    await closeDb()
    process.exit(1)
  })
