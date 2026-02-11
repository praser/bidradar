import {
  pgTable,
  text,
  uuid,
  integer,
  numeric,
  timestamp,
} from 'drizzle-orm/pg-core'

export const offers = pgTable('offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: text('source_id').notNull().unique(),
  uf: text('uf').notNull(),
  city: text('city').notNull(),
  neighborhood: text('neighborhood').notNull(),
  address: text('address').notNull(),
  askingPrice: numeric('asking_price', { precision: 18, scale: 2 }).notNull(),
  evaluationPrice: numeric('evaluation_price', {
    precision: 18,
    scale: 2,
  }).notNull(),
  discountPercent: numeric('discount_percent', { precision: 6, scale: 2 }).notNull(),
  description: text('description').notNull(),
  sellingType: text('selling_type').notNull(),
  offerUrl: text('offer_url').notNull(),
  version: integer('version').notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  removedAt: timestamp('removed_at', { withTimezone: true }),
})

export type OfferRow = typeof offers.$inferSelect
export type OfferInsert = typeof offers.$inferInsert
