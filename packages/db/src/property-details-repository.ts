import type { PropertyDetails } from '@bidradar/core'
import { getDb } from './connection.js'
import { propertyDetails } from './schema.js'

function toRow(offerId: string, details: PropertyDetails) {
  return {
    offerId,
    totalArea: details.totalArea !== null ? String(details.totalArea) : null,
    privateArea: details.privateArea !== null ? String(details.privateArea) : null,
    landArea: details.landArea !== null ? String(details.landArea) : null,
    bedrooms: details.bedrooms,
    bathrooms: details.bathrooms,
    livingRooms: details.livingRooms,
    kitchens: details.kitchens,
    garageSpaces: details.garageSpaces,
    hasServiceArea: details.hasServiceArea,
  }
}

export function createPropertyDetailsRepository() {
  const db = getDb()

  return {
    async upsert(offerId: string, details: PropertyDetails): Promise<void> {
      const row = toRow(offerId, details)
      await db
        .insert(propertyDetails)
        .values(row)
        .onConflictDoUpdate({
          target: propertyDetails.offerId,
          set: row,
        })
    },
  }
}
