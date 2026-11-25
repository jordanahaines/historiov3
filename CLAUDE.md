# CLAUDE.md

Technical reference for Claude Code working on Historio v3. This repo is a deliberate restart of the original `historio-app` (Boards + six Elements), which grew beyond its purpose. **Scope discipline is the point of v3**: see everything you've read — Kindle highlights, turned into Insights — on one map and one timeline. Don't bring back features from v1 (Elements, grid layouts, comments, forking, per-Element filters) unless the Project Overview (below) calls for them.

## Project Context (Notion)

The **[Historio v3: Project Overview](https://app.notion.com/p/4162dd9d3fb7813a8ba0cd884c1eac22)** page in Notion is the single source of truth for product context: vision, core concepts, epics and scope (what is in scope now), the feature list, principles, sitemap and its decisions (routes and nav), plan/status, and open questions. It is deliberately **not** duplicated here.

- **Before implementing or speccing a task, fetch it** with `notion-fetch` and make sure the work matches the epic scope and sitemap. Only work in scope is in scope; if a task needs something the Overview marks as a later epic or "Future", flag it rather than building it.
- **Keep it up to date.** When your work changes anything the Overview describes — a feature shipped or changed, a decision made, a route added or moved, an open question resolved, plan/status moved — update the page (via the Notion MCP) in the same task, and say what you changed in the PR description. If you only notice it is stale or wrong, tell the user instead of silently editing.
- Technical conventions live in this file. If the Overview and the code disagree on a technical point, flag it rather than guessing.

## Project Management

issue_tracker: notion
notion_data_source_id: collection://40d2dd9d-3fb7-80e1-875f-000b7d4f3e4a
notion_database_url: https://app.notion.com/p/40d2dd9d3fb7805ca0ebdc145ab228de

Issues live in the **Historio Product Roadmap** Notion database (shared with the v1 repo — v3 items are distinguished by their title/epic, e.g. an "E1" parent). The `em-*` skills read this section. Access via the Notion MCP tools; always fetch the data source first to get the current schema. Do not create GitHub Issues; PRs live on GitHub (`jordanahaines/historiov3`). Status/Priority/Effort/Category properties and workflow are the same as the v1 repo: `Backlog` = stub, `Planned` = specified, `In progress` = building (PR URL at top of the page body), `Completed` = merged.

## Design file

The Pencil design file lives **outside this repo** (it caused constant merge conflicts): `historiov3.pen` in a local `designs-pen/` folder (by default `~/Documents/designs-pen/historiov3.pen`; the location is per-machine, so ask the user if it isn't there). It is not tracked or copied here; open it by absolute path with the Pencil MCP tools (`.pen` files are encrypted, so never Read/Grep them) and add the folder as a working directory if needed. Visual guidelines stay in `design.md`. When a skill (e.g. `em-design`) looks for `design.pen` in the project root, use this file instead. Frame and component names in `design.md` refer to it.

## Risky actions

- **Migrations:** fine to generate and apply (`pnpm db:generate`, `pnpm db:migrate`) without asking, including against the shared Supabase project. Everything stays in the `v3` schema.
- **LLM-spending runs: confirm first.** Anything that calls models in bulk or against real data — `pnpm ingest:pdf`, `pnpm pipeline:resume`, scripts that loop over highlights, large backfills. Say roughly what it will cost (highlight count × stages) and wait for a yes. A single call in a unit test or a one-off prompt check doesn't need one.
- **Destroying data: confirm first**, even in staging or on rows that look like test data. That covers `DELETE`/`TRUNCATE`/`DROP`, removing Storage objects, resetting or re-importing a user's data, and rolling back a migration that drops columns. Look at what the target contains before asking.

## Tech Stack

Next.js (App Router) · TypeScript strict · Drizzle ORM · Supabase (Postgres + Auth + Storage) · HeroUI · Tailwind CSS (SCSS only where Tailwind can't) · Vercel · Vercel AI SDK via AI Gateway · MapLibre GL JS + Stadia Maps · vis-timeline (thin custom React wrapper) · Resend (inbound email) · Vitest + React Testing Library · pnpm.

## Data model

- `profiles` — mirrors `auth.users` (trigger `v3.handle_new_user`); holds `inbound_token`. Inbound address = `<inbound_token>@<INBOUND_EMAIL_DOMAIN>` (Resend receiving domain, any local part).
- `books` — shared catalog (ASIN is the match key). `user_books` — a user's library; nothing shows unless a row exists with `status = 'active'`. Remove a book by setting `status = 'removed'`, never by deleting the row (that cascades to highlights/lineage and strands insights); every library read in `lib/authz/` filters on `active`. `highlights` FKs `(user_id, book_id)` to it.
- `ingestion_events` — one row per inbound email; unique `resend_email_id` makes webhook retries idempotent.
- `highlights` — raw highlights + pipeline `status` (`pending → contextualized → researched`, or `discarded`/`failed`). Dedup key: `(user_id, book_id, source, external_id)`.
- `insights` — per-user, typed (`event|person|place|concept`), `status` `published|hidden` (published by default — no review gate). Period = astronomical year + optional month/day for start and end (null end = the start's own precision unit); generated `starts_value`/`ends_value` for indexed overlap. Area = PostGIS `geometry(Geometry, 4326)` (point or polygon). Read it with `ST_AsGeoJSON(location)`, write with `ST_SetSRID(ST_GeomFromGeoJSON(..), 4326)`.
- `insight_highlights` — lineage; a book's insights and an insight's books derive through it. `contribution` stores what each highlight said, unmerged.

Pipeline flow, setup and local commands: `docs/ingestion-pipeline.md`. Workflow step functions live in `lib/workflows/`; keep workflow bodies pure orchestration and all logic in `"use step"` functions (they pass ids/paths, never bytes). Tests: `pnpm test` (unit), `pnpm test:integration` (real `v3` DB), `pnpm test:workflows`.

### Duplicate Insights: merge and enrich

Implemented in `lib/insights/merge-candidates.ts` (details in `docs/ingestion-pipeline.md`). Before creating an Insight, look for an existing one for the same user: same `type`, overlapping period, intersecting/nearby location, trigram-similar title or alias. Shortlist → LLM "same real-world thing?" judge (structured output). On a match: add an `insight_highlights` row (skip if it exists — idempotent), then **regenerate** the description from all contributions (never patch iteratively), add the new title to `aliases`, set `last_enriched_at`. If unsure, create a new Insight — a duplicate is cheaper than a wrong merge. Serialize match-then-write per user (advisory lock / workflow concurrency key) so parallel highlights don't both insert. Known open problems (drift, conflicting dates, user edits, undo) are deferred.

## Coding conventions

- Strict TypeScript, no `any` without a comment. Prefer `type`. Validate all external input (forms, webhooks, AI structured output) with `zod`.
- Server Components for reads, Server Actions for mutations, Route Handlers only for external callers (the Resend webhook).
- Routes in `app/`, shared components in `components/<feature>/`. One component per file, filename matches the export. DB schema `lib/db/schema.ts`, authz `lib/authz/`, AI prompts `lib/ai/prompts/`. Components `PascalCase`, other files `kebab-case`, DB `snake_case` mapped to camelCase in TS.
- Library lens/scope/search filtering is client-side state (load the user's library once, filter in the browser); changing a filter must not trigger a server re-render. Mirror scope to the URL with `history.replaceState`, not router navigation.
- Keep logic out of JSX: compute values above the `return`; extract a component when a list item needs more than a line or two.
- Tailwind first; HeroUI before custom UI. Map Elements/cards have sharp corners (`rounded-none`).
- AI: structured output for anything that becomes an Insight; prompts in `lib/ai/prompts/`; every model call uses `resolveModel(ENV_VAR, DEFAULT)` pattern with a documented env var; default to AI Gateway `"provider/model"` strings.
- **Scripts that import `lib/db` must exit the process** (the postgres.js pool keeps it alive): `main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => { console.error(e); process.exit(1); })`. Run ad-hoc ones under `timeout`.
- Env vars: secrets in `.env` (gitignored), documented placeholders in `.env.example`. Never commit keys.
- Prettier owns formatting. Commit messages: imperative mood, clear subject. CI runs type-check, lint, format:check, test.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
