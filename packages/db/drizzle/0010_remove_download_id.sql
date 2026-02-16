ALTER TABLE "offers" DROP CONSTRAINT "offers_download_id_download_metadata_id_fk";
--> statement-breakpoint
ALTER TABLE "offers" DROP COLUMN "download_id";
--> statement-breakpoint
DROP VIEW IF EXISTS "current_offers";
--> statement-breakpoint
CREATE VIEW "current_offers" AS
SELECT * FROM (
  SELECT DISTINCT ON (source_id) *
  FROM offers
  ORDER BY source_id, version DESC
) latest
WHERE operation != 'delete';
