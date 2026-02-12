CREATE TABLE "property_details" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"offer_id" uuid NOT NULL,
	"total_area" numeric(10, 2),
	"private_area" numeric(10, 2),
	"land_area" numeric(10, 2),
	"bedrooms" integer,
	"bathrooms" integer,
	"living_rooms" integer,
	"kitchens" integer,
	"garage_spaces" integer,
	"has_service_area" boolean DEFAULT false NOT NULL,
	CONSTRAINT "property_details_offer_id_unique" UNIQUE("offer_id")
);
--> statement-breakpoint
ALTER TABLE "property_details" ADD CONSTRAINT "property_details_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE no action ON UPDATE no action;