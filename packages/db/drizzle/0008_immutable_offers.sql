-- Step 1: Add new columns
ALTER TABLE "offers" ADD COLUMN "operation" text NOT NULL DEFAULT 'insert';
ALTER TABLE "offers" ADD COLUMN "download_id" uuid;
ALTER TABLE "offers" ADD COLUMN "created_at" timestamptz NOT NULL DEFAULT now();

-- Step 2: Backfill created_at from updated_at
UPDATE "offers" SET "created_at" = "updated_at";

-- Step 3: Backfill operation for rows with version > 1
UPDATE "offers" SET "operation" = 'update' WHERE "version" > 1;

-- Step 4: Delete soft-deleted rows (they'll be re-discovered as 'delete' on next reconciliation)
DELETE FROM "property_details" WHERE "offer_id" IN (
  SELECT "id" FROM "offers" WHERE "removed_at" IS NOT NULL
);
DELETE FROM "offers" WHERE "removed_at" IS NOT NULL;

-- Step 5: Drop old columns
ALTER TABLE "offers" DROP COLUMN "updated_at";
ALTER TABLE "offers" DROP COLUMN "last_seen_at";
ALTER TABLE "offers" DROP COLUMN "removed_at";

-- Step 6: Drop unique constraint on source_id
ALTER TABLE "offers" DROP CONSTRAINT "offers_source_id_unique";

-- Step 7: Add FK constraint for download_id
ALTER TABLE "offers" ADD CONSTRAINT "offers_download_id_download_metadata_id_fk"
  FOREIGN KEY ("download_id") REFERENCES "download_metadata"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- Step 8: Create index on (source_id, version DESC)
CREATE INDEX "idx_offers_source_id_version" ON "offers" ("source_id", "version" DESC);

-- Step 9: Remove default on operation column (it was only for backfill)
ALTER TABLE "offers" ALTER COLUMN "operation" DROP DEFAULT;

-- Step 10: Create current_offers view
CREATE VIEW "current_offers" AS
SELECT * FROM (
  SELECT DISTINCT ON (source_id) *
  FROM offers
  ORDER BY source_id, version DESC
) latest
WHERE operation != 'delete';
