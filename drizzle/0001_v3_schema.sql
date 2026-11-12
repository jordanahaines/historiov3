CREATE SCHEMA IF NOT EXISTS "v3";
--> statement-breakpoint
CREATE TYPE "v3"."highlight_status" AS ENUM('pending', 'discarded', 'contextualized', 'researched', 'failed');--> statement-breakpoint
CREATE TYPE "v3"."import_source" AS ENUM('kindle_scribe');--> statement-breakpoint
CREATE TYPE "v3"."ingestion_status" AS ENUM('received', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "v3"."insight_status" AS ENUM('published', 'hidden');--> statement-breakpoint
CREATE TYPE "v3"."insight_type" AS ENUM('event', 'person', 'place', 'concept');--> statement-breakpoint
CREATE TYPE "v3"."note_origin" AS ENUM('typed', 'handwritten');--> statement-breakpoint
CREATE TABLE "v3"."books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"title" text NOT NULL,
	"author" text,
	"asin" text,
	"isbn" text,
	"cover_image_url" text,
	CONSTRAINT "books_asin_unique" UNIQUE("asin")
);
--> statement-breakpoint
ALTER TABLE "v3"."books" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v3"."highlights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"ingestion_event_id" uuid,
	"source" "v3"."import_source" NOT NULL,
	"external_id" text NOT NULL,
	"page" integer,
	"chapter" text,
	"highlighted_text" text NOT NULL,
	"note_text" text,
	"note_origin" "v3"."note_origin",
	"note_image_path" text,
	"annotated_at" timestamp with time zone,
	"status" "v3"."highlight_status" DEFAULT 'pending' NOT NULL,
	"context" text,
	"discard_reason" text,
	"researched_at" timestamp with time zone,
	CONSTRAINT "highlights_dedup_unique" UNIQUE("user_id","book_id","source","external_id")
);
--> statement-breakpoint
ALTER TABLE "v3"."highlights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v3"."ingestion_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" "v3"."import_source" NOT NULL,
	"status" "v3"."ingestion_status" DEFAULT 'received' NOT NULL,
	"resend_email_id" text,
	"from_address" text,
	"subject" text,
	"attachment_path" text,
	"book_id" uuid,
	"highlights_found" integer DEFAULT 0 NOT NULL,
	"highlights_new" integer DEFAULT 0 NOT NULL,
	"error" text,
	"completed_at" timestamp with time zone,
	CONSTRAINT "ingestion_events_resend_email_id_unique" UNIQUE("resend_email_id")
);
--> statement-breakpoint
ALTER TABLE "v3"."ingestion_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v3"."insight_highlights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"insight_id" uuid NOT NULL,
	"highlight_id" uuid NOT NULL,
	"contribution" text NOT NULL,
	CONSTRAINT "insight_highlights_unique" UNIQUE("insight_id","highlight_id")
);
--> statement-breakpoint
ALTER TABLE "v3"."insight_highlights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v3"."insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "v3"."insight_type" NOT NULL,
	"status" "v3"."insight_status" DEFAULT 'published' NOT NULL,
	"title" text NOT NULL,
	"aliases" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"description" text,
	"starts_year" integer NOT NULL,
	"starts_month" smallint,
	"starts_day" smallint,
	"ends_year" integer,
	"ends_month" smallint,
	"ends_day" smallint,
	"starts_value" double precision GENERATED ALWAYS AS ((starts_year::double precision + (coalesce(starts_month, 1) - 1) / 12.0 + (coalesce(starts_day, 1) - 1) / 372.0)) STORED,
	"ends_value" double precision GENERATED ALWAYS AS (CASE WHEN ends_year IS NULL THEN (CASE WHEN starts_month IS NULL THEN starts_year + 1.0 WHEN starts_day IS NULL THEN starts_year + starts_month / 12.0 ELSE starts_year + (starts_month - 1) / 12.0 + starts_day / 372.0 END) ELSE (CASE WHEN ends_month IS NULL THEN ends_year + 1.0 WHEN ends_day IS NULL THEN ends_year + ends_month / 12.0 ELSE ends_year + (ends_month - 1) / 12.0 + ends_day / 372.0 END) END) STORED,
	"location" geometry(Geometry, 4326),
	"location_name" text,
	"last_enriched_at" timestamp with time zone,
	CONSTRAINT "insights_period_ordered" CHECK ("v3"."insights"."ends_value" >= "v3"."insights"."starts_value")
);
--> statement-breakpoint
ALTER TABLE "v3"."insights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v3"."profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"inbound_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_inbound_token_unique" UNIQUE("inbound_token")
);
--> statement-breakpoint
ALTER TABLE "v3"."profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "v3"."user_books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	CONSTRAINT "user_books_user_book_unique" UNIQUE("user_id","book_id")
);
--> statement-breakpoint
ALTER TABLE "v3"."user_books" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "v3"."highlights" ADD CONSTRAINT "highlights_ingestion_event_id_ingestion_events_id_fk" FOREIGN KEY ("ingestion_event_id") REFERENCES "v3"."ingestion_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v3"."highlights" ADD CONSTRAINT "highlights_user_book_fk" FOREIGN KEY ("user_id","book_id") REFERENCES "v3"."user_books"("user_id","book_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v3"."ingestion_events" ADD CONSTRAINT "ingestion_events_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "v3"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v3"."ingestion_events" ADD CONSTRAINT "ingestion_events_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "v3"."books"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v3"."insight_highlights" ADD CONSTRAINT "insight_highlights_insight_id_insights_id_fk" FOREIGN KEY ("insight_id") REFERENCES "v3"."insights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v3"."insight_highlights" ADD CONSTRAINT "insight_highlights_highlight_id_highlights_id_fk" FOREIGN KEY ("highlight_id") REFERENCES "v3"."highlights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v3"."insights" ADD CONSTRAINT "insights_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "v3"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v3"."profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v3"."user_books" ADD CONSTRAINT "user_books_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "v3"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "v3"."user_books" ADD CONSTRAINT "user_books_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "v3"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "highlights_status_idx" ON "v3"."highlights" USING btree ("status");--> statement-breakpoint
CREATE INDEX "highlights_book_id_idx" ON "v3"."highlights" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "ingestion_events_user_id_idx" ON "v3"."ingestion_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "insight_highlights_highlight_id_idx" ON "v3"."insight_highlights" USING btree ("highlight_id");--> statement-breakpoint
CREATE INDEX "insights_user_status_idx" ON "v3"."insights" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "insights_period_idx" ON "v3"."insights" USING btree ("starts_value","ends_value");--> statement-breakpoint
CREATE INDEX "insights_location_gist_idx" ON "v3"."insights" USING gist ("location");--> statement-breakpoint
CREATE INDEX "insights_title_trgm_idx" ON "v3"."insights" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "user_books_book_id_idx" ON "v3"."user_books" USING btree ("book_id");