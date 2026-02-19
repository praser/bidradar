CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "worker_heartbeats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" text NOT NULL,
	"last_heartbeat_at" timestamp with time zone DEFAULT now() NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_keys_key_hash" ON "api_keys" USING btree ("key_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_api_keys_user_id" ON "api_keys" USING btree ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_worker_heartbeats_worker_id" ON "worker_heartbeats" USING btree ("worker_id");
