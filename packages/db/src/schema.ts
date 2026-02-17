import {
  boolean,
  jsonb,
  pgTable,
  pgView,
  text,
  uuid,
  integer,
  numeric,
  timestamp,
  index,
} from 'drizzle-orm/pg-core'

export const downloadMetadata = pgTable(
  'download_metadata',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    fileName: text('file_name').notNull(),
    fileExtension: text('file_extension').notNull(),
    fileSize: integer('file_size').notNull(),
    fileType: text('file_type').notNull(),
    downloadUrl: text('download_url').notNull(),
    downloadedAt: timestamp('downloaded_at', { withTimezone: true }).notNull(),
    bucketName: text('bucket_name').notNull(),
    bucketKey: text('bucket_key').notNull(),
    contentHash: text('content_hash'),
  },
  (table) => [
    index('idx_download_metadata_content_hash').on(table.contentHash),
  ],
)

export type DownloadMetadataRow = typeof downloadMetadata.$inferSelect
export type DownloadMetadataInsert = typeof downloadMetadata.$inferInsert

export const offers = pgTable(
  'offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sourceId: text('source_id').notNull(),
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
    propertyType: text('property_type').notNull().default(''),
    sellingType: text('selling_type').notNull(),
    offerUrl: text('offer_url').notNull(),
    version: integer('version').notNull().default(1),
    operation: text('operation').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_offers_source_id_version').on(table.sourceId, table.version),
  ],
)

export type OfferRow = typeof offers.$inferSelect
export type OfferInsert = typeof offers.$inferInsert

export const currentOffers = pgView('current_offers', {
  id: uuid('id'),
  sourceId: text('source_id'),
  uf: text('uf'),
  city: text('city'),
  neighborhood: text('neighborhood'),
  address: text('address'),
  askingPrice: numeric('asking_price', { precision: 18, scale: 2 }),
  evaluationPrice: numeric('evaluation_price', { precision: 18, scale: 2 }),
  discountPercent: numeric('discount_percent', { precision: 6, scale: 2 }),
  description: text('description'),
  propertyType: text('property_type'),
  sellingType: text('selling_type'),
  offerUrl: text('offer_url'),
  version: integer('version'),
  operation: text('operation'),
  createdAt: timestamp('created_at', { withTimezone: true }),
}).existing()

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  googleId: text('google_id').notNull().unique(),
  role: text('role', { enum: ['admin', 'free'] }).notNull().default('free'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export type UserRow = typeof users.$inferSelect
export type UserInsert = typeof users.$inferInsert

export const propertyDetails = pgTable('property_details', {
  id: uuid('id').primaryKey().defaultRandom(),
  offerId: uuid('offer_id')
    .notNull()
    .unique()
    .references(() => offers.id),
  totalArea: numeric('total_area', { precision: 10, scale: 2 }),
  privateArea: numeric('private_area', { precision: 10, scale: 2 }),
  landArea: numeric('land_area', { precision: 10, scale: 2 }),
  bedrooms: integer('bedrooms'),
  bathrooms: integer('bathrooms'),
  livingRooms: integer('living_rooms'),
  kitchens: integer('kitchens'),
  garageSpaces: integer('garage_spaces'),
  hasServiceArea: boolean('has_service_area').notNull().default(false),
})

export type PropertyDetailsRow = typeof propertyDetails.$inferSelect
export type PropertyDetailsInsert = typeof propertyDetails.$inferInsert

export const authSessions = pgTable('auth_sessions', {
  id: text('id').primaryKey(),
  result: jsonb('result'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})
