CREATE TABLE "auth_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
