# CLAUDE.md

Technical reference for Claude Code working on Historio v3. This repo is a deliberate restart of the original `historio-app` (Boards + six Elements), which grew beyond its purpose. **Scope discipline is the point of v3**: see everything you've read — Kindle highlights, turned into Insights — on one map and one timeline. Don't bring back features from v1 (Elements, grid layouts, comments, forking, per-Element filters) unless an epic below calls for them.

## Epics

- **E1 — Library.** Email Kindle Scribe highlights to a per-user Historio address; parse, contextualize, research into Insights; show them on a Library Map and Library Timeline, then side-by-side with cross-filtering.
- **E1.5 — Accounts.** Any user can sign up; add Readwise (or other) import in addition to Scribe email.
- **E2 — Boards.** Boards are always map + timeline side-by-side; they differ only in which books/insights they include. An agent configures, enriches, and answers questions on a board. Boards can be public (view-only).

Only E1 is in scope until told otherwise, but nothing in the schema should block E1.5/E2 (everything is already per-user).

## Project Management

issue_tracker: notion
notion_data_source_id: collection://40d2dd9d-3fb7-80e1-875f-000b7d4f3e4a
notion_database_url: https://app.notion.com/p/40d2dd9d3fb7805ca0ebdc145ab228de

Issues live in the **Historio Product Roadmap** Notion database (shared with the v1 repo — v3 items are distinguished by their title/epic, e.g. an "E1" parent). The `em-*` skills read this section. Access via the Notion MCP tools; always fetch the data source first to get the current schema. Do not create GitHub Issues; PRs live on GitHub (`jordanahaines/historiov3`). Status/Priority/Effort/Category properties and workflow are the same as the v1 repo: `Backlog` = stub, `Planned` = specified, `In progress` = building (PR URL at top of the page body), `Completed` = merged.

## Tech Stack

Next.js (App Router) · TypeScript strict · Drizzle ORM · Supabase (Postgres + Auth + Storage) · HeroUI · Tailwind CSS (SCSS only where Tailwind can't) · Vercel · Vercel AI SDK via AI Gateway · MapLibre GL JS + Stadia Maps · vis-timeline (thin custom React wrapper) · Resend (inbound email) · Vitest + React Testing Library · pnpm.

## Architecture: Drizzle + Supabase split

- **Drizzle owns all database access.** Never `supabase.from(...)`. supabase-js is for **Auth and Storage only**. The Supabase Data API is disabled.
- Drizzle connects directly as the table owner, which bypasses RLS. RLS is enabled on every table with no policies (deny-by-default backstop); **authorization is application code** in `lib/authz/`.
- Every read/write of user data goes through a function in `lib/authz/` that takes the viewer's id explicitly. No inline Drizzle queries in components, Server Actions, or Route Handlers.
- `DATABASE_URL` = transaction-mode pooler (port 6543, `prepare: false`) for runtime. `DATABASE_URL_DIRECT` = direct connection (5432) for migrations only.

### The `v3` Postgres schema

This project shares a Supabase project with the old app. **Everything lives in the `v3` schema; never touch `public` or `drizzle`.** The migration journal is `v3.__drizzle_migrations`. Extensions (`postgis`, `pg_trgm`) live in Supabase's `extensions` schema. Source of truth: `lib/db/schema.ts`.

Migrations: `pnpm db:generate` then apply. Note `drizzle-kit migrate` swallows errors silently in this setup — if it exits quietly but tables are missing, apply with `drizzle-orm/postgres-js/migrator` (`migrationsSchema: "v3"`, `migrationsTable: "__drizzle_migrations"`) in a script to see the real error. Custom SQL (triggers, extensions) goes in `drizzle-kit generate --custom`.

## Data model

- `profiles` — mirrors `auth.users` (trigger `v3.handle_new_user`); holds `inbound_token`. Inbound address = `<inbound_token>@<INBOUND_EMAIL_DOMAIN>` (Resend receiving domain, any local part).
- `books` — shared catalog (ASIN is the match key). `user_books` — a user's library; nothing shows unless a row exists with `status = 'active'`. Remove a book by setting `status = 'removed'`, never by deleting the row (that cascades to highlights/lineage and strands insights); every library read in `lib/authz/` filters on `active`. `highlights` FKs `(user_id, book_id)` to it.
- `ingestion_events` — one row per inbound email; unique `resend_email_id` makes webhook retries idempotent.
- `highlights` — raw highlights + pipeline `status` (`pending → contextualized → researched`, or `discarded`/`failed`). Dedup key: `(user_id, book_id, source, external_id)`.
- `insights` — per-user, typed (`event|person|place|concept`), `status` `published|hidden` (published by default — no review gate). Period = astronomical year + optional month/day for start and end (null end = the start's own precision unit); generated `starts_value`/`ends_value` for indexed overlap. Area = PostGIS `geometry(Geometry, 4326)` (point or polygon). Read it with `ST_AsGeoJSON(location)`, write with `ST_SetSRID(ST_GeomFromGeoJSON(..), 4326)`.
- `insight_highlights` — lineage; a book's insights and an insight's books derive through it. `contribution` stores what each highlight said, unmerged.

### Duplicate Insights: merge and enrich

Before creating an Insight, look for an existing one for the same user: same `type`, overlapping period, intersecting/nearby location, trigram-similar title or alias. Shortlist → LLM "same real-world thing?" judge (structured output). On a match: add an `insight_highlights` row (skip if it exists — idempotent), then **regenerate** the description from all contributions (never patch iteratively), add the new title to `aliases`, set `last_enriched_at`. If unsure, create a new Insight — a duplicate is cheaper than a wrong merge. Serialize match-then-write per user (advisory lock / workflow concurrency key) so parallel highlights don't both insert. Known open problems (drift, conflicting dates, user edits, undo) are deferred.

## Coding conventions

- Strict TypeScript, no `any` without a comment. Prefer `type`. Validate all external input (forms, webhooks, AI structured output) with `zod`.
- Server Components for reads, Server Actions for mutations, Route Handlers only for external callers (the Resend webhook).
- Routes in `app/`, shared components in `components/<feature>/`. One component per file, filename matches the export. DB schema `lib/db/schema.ts`, authz `lib/authz/`, AI prompts `lib/ai/prompts/`. Components `PascalCase`, other files `kebab-case`, DB `snake_case` mapped to camelCase in TS.
- Keep logic out of JSX: compute values above the `return`; extract a component when a list item needs more than a line or two.
- Tailwind first; HeroUI before custom UI. Map Elements/cards have sharp corners (`rounded-none`).
- AI: structured output for anything that becomes an Insight; prompts in `lib/ai/prompts/`; every model call uses `resolveModel(ENV_VAR, DEFAULT)` pattern with a documented env var; default to AI Gateway `"provider/model"` strings.
- **Scripts that import `lib/db` must exit the process** (the postgres.js pool keeps it alive): `main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1); })`. Run ad-hoc ones under `timeout`.
- Env vars: secrets in `.env` (gitignored), documented placeholders in `.env.example`. Never commit keys.
- Prettier owns formatting. Commit messages: imperative mood, clear subject. CI runs type-check, lint, format:check, test.
