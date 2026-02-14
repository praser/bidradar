CREATE TABLE "download_metadata" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_name" text NOT NULL,
	"file_extension" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_type" text NOT NULL,
	"download_url" text NOT NULL,
	"downloaded_at" timestamp with time zone NOT NULL,
	"bucket_name" text NOT NULL,
	"bucket_key" text NOT NULL
);
