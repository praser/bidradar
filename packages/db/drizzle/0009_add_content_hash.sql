ALTER TABLE "download_metadata" ADD COLUMN "content_hash" text;
--> statement-breakpoint
CREATE INDEX "idx_download_metadata_content_hash" ON "download_metadata" ("content_hash");
