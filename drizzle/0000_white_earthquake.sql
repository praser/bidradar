CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" text NOT NULL,
	"uf" text NOT NULL,
	"city" text NOT NULL,
	"neighborhood" text NOT NULL,
	"address" text NOT NULL,
	"asking_price" numeric(18, 2) NOT NULL,
	"evaluation_price" numeric(18, 2) NOT NULL,
	"discount_percent" numeric(6, 2) NOT NULL,
	"description" text NOT NULL,
	"selling_type" text NOT NULL,
	"offer_url" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "offers_source_id_unique" UNIQUE("source_id")
);
