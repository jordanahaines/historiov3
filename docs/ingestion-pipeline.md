# Scribe email → Insights pipeline

How a Kindle Scribe notebook becomes a user's insights. Spec: the "v3: Scribe email → Insights pipeline" story in the Notion roadmap.

## Flow

```
Kindle Scribe → Share → email PDF to <inbound_token>@<INBOUND_EMAIL_DOMAIN>
  → POST /api/inbound/resend            app/api/inbound/resend/route.ts
      verify signature (raw body) → resolve user from the token → record
      ingestion_event (unique resend_email_id) → start ingestEmailWorkflow → 200
  → ingestEmailWorkflow                 lib/workflows/ingest-email.ts
      storeAttachments  PDF(s) from Resend → private Storage bucket
      importNotebook    parse → transcribe handwriting → book → user_books → highlights
      startHighlightWorkflows  one processHighlightWorkflow per still-pending highlight
      completeIngestion / failIngestion
  → processHighlightWorkflow            lib/workflows/process-highlight.ts
      contextualizeHighlight   discard XOR context
      runEventResearcher ‖ runPersonResearcher   (return candidates, write nothing)
      mergeHighlightInsights   create or enrich insights, mark highlight researched
```

## Rules worth knowing

- **Identity comes only from the recipient token.** `lib/inbound/handle-inbound-email.ts` never reads a user id from the payload. Unknown tokens are acknowledged with 200 and logged, so Resend doesn't retry.
- **Steps pass ids and storage paths, never file bytes** — step inputs/outputs are persisted. Notebook PDFs live in the private `ingestion-attachments` bucket, handwritten-note scans in `note-scans` (both created by migration `0005`, no policies; the server uses `SUPABASE_SECRET_KEY`).
- **Import is retry-safe.** Highlights are deduped on `(user_id, book_id, source, external_id)` with `external_id = p<page>-<sha256(text)>`; scans are uploaded (upsert) before rows are inserted; `startHighlightWorkflows` reads `pending` rows for the event rather than trusting the import step's return value.
- **Highlight status** moves `pending → contextualized → researched`, or `discarded`, or `failed` (a workflow that exhausted its retries). A highlight already `researched` or `discarded` is a no-op when replayed.
- **Limits:** only `event` and `person` point insights are produced. Place/concept researchers and polygon areas are supported by the schema but not generated.

## Merge and enrich

`lib/insights/merge-candidates.ts`, DB primitives in `lib/authz/insights.ts`. For each candidate a highlight produces:

1. **Normalize** (`lib/insights/candidate.ts`): LLM dates are range-checked so they can't violate the `insights` check constraints (bad months dropped, a day needs a month, an end month/day needs an end year, an end before the start is dropped).
2. **Shortlist** the user's insights (any status, including `hidden`): same `type`; period overlapping after widening both sides by 1 year; if the candidate has a point, within 50 km of insights that have a location; ranked by best title/alias trigram similarity; max 5. Empty shortlist → no model call.
3. **Judge** (`lib/ai/agents/insight-matcher.ts`): answers with a 1-based `matchIndex` and `confidence`. Only `high` confidence and an in-range index merges; an error, low confidence, or bad index creates a new insight (a duplicate is cheaper than a wrong merge). Indices are used instead of ids so the model can't mangle a UUID.
4. **Create** a published insight, or **enrich** the match: add an `insight_highlights` row carrying this highlight's `contribution` (skipped if the pair already exists), add the candidate's title as an alias if new, regenerate `description` from _all_ contributions (`insight-synthesizer.ts`; with one contribution it's used verbatim), set `last_enriched_at`. The matched insight's own title, period and location never change.

Everything for one highlight — insights, links and `status = researched` — commits in one transaction holding `pg_advisory_xact_lock` on the user, so parallel highlights can't both create the same insight, and a replay is a no-op. The lock is held across the judge/synthesizer calls; fine for one user, revisit (judge outside the lock, re-shortlist inside) if it becomes a bottleneck.

## Setup (one-time, manual)

1. Resend: enable receiving on the account's `*.resend.app` domain (free tier) and add a webhook for `email.received` pointing at `https://<deployment>/api/inbound/resend`. Copy the signing secret.
2. Set `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`, `INBOUND_EMAIL_DOMAIN` (e.g. `ioestiogra.resend.app`) and the AI/Supabase variables on the deployment (see `.env.example`).
3. Create your auth user in Supabase; the signup trigger creates the `v3.profiles` row. Your address is `<profiles.inbound_token>@<INBOUND_EMAIL_DOMAIN>`.

## Local use (no Resend)

```bash
pnpm ingest:pdf path/to/notebook.pdf --user <profile-id>   # import + run the pipeline inline (4 highlights at a time; --concurrency N)
pnpm ingest:pdf path/to/notebook.pdf --user <profile-id> --no-process
pnpm pipeline:resume [--user <profile-id>] [--concurrency N]   # re-run pending / contextualized / failed highlights
```

The CLIs run workflow step functions directly in-process (outside the workflow runtime they're plain async functions).

## Tests

- `pnpm test` — unit tests, no network or DB.
- `pnpm test:integration` — real Supabase `v3` schema; each test creates and deletes its own auth user.
- `pnpm test:workflows` — workflow-runtime orchestration tests using fixture workflows with fake steps.

## Licensing note

`historio-kindle-scribe-notes-parser` is built on `mupdf` (AGPL-3.0). This is a deliberate, accepted choice for this hobby project (Historio is PolyForm Noncommercial, which isn't compatible with AGPL's network copyleft if linked into the running app). Re-evaluate if compliance becomes a real concern; the parser's logic isn't tightly bound to `mupdf`'s API.

## Known gaps (deferred)

Conflicting dates/places between merged sources; preserving user edits to an insight; un-merge; AI cost/rate limits; a sender allowlist; outbound confirmation email.
