CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"severity" text NOT NULL,
	"status" text DEFAULT 'investigating' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"affected_tenants" uuid[] DEFAULT '{}' NOT NULL,
	"all_tenants" boolean DEFAULT false NOT NULL,
	"updates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
