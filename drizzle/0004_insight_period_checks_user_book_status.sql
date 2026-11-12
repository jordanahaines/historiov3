CREATE TYPE "v3"."user_book_status" AS ENUM('active', 'removed');--> statement-breakpoint
ALTER TABLE "v3"."user_books" ADD COLUMN "status" "v3"."user_book_status" DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "v3"."insights" ADD CONSTRAINT "insights_starts_valid" CHECK (("v3"."insights"."starts_month" IS NULL OR "v3"."insights"."starts_month" BETWEEN 1 AND 12)
          AND ("v3"."insights"."starts_day" IS NULL OR ("v3"."insights"."starts_day" BETWEEN 1 AND 31 AND "v3"."insights"."starts_month" IS NOT NULL)));--> statement-breakpoint
ALTER TABLE "v3"."insights" ADD CONSTRAINT "insights_ends_valid" CHECK (("v3"."insights"."ends_year" IS NOT NULL OR ("v3"."insights"."ends_month" IS NULL AND "v3"."insights"."ends_day" IS NULL))
          AND ("v3"."insights"."ends_month" IS NULL OR "v3"."insights"."ends_month" BETWEEN 1 AND 12)
          AND ("v3"."insights"."ends_day" IS NULL OR ("v3"."insights"."ends_day" BETWEEN 1 AND 31 AND "v3"."insights"."ends_month" IS NOT NULL)));