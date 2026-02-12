ALTER TABLE "offers" ADD COLUMN "last_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "removed_at" timestamp with time zone;