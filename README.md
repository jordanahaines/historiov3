# historiov3
Share History

See everything you've read on one map and one timeline. Email Kindle Scribe highlights to your Historio address; they become dated, located Insights in your personal library.

## Getting started

```bash
pnpm install
cp .env.example .env      # fill in the values
pnpm db:migrate           # applies ./drizzle to the `v3` schema
pnpm dev
```

- `CLAUDE.md` — architecture, data model and conventions.
- `docs/ingestion-pipeline.md` — the Scribe email → Insights pipeline, Resend setup, and local commands.
