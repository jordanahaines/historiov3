-- Extensions live in Supabase's shared `extensions` schema (not v3).
create extension if not exists postgis with schema extensions;
--> statement-breakpoint
create extension if not exists pg_trgm with schema extensions;
