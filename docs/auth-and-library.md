# Viewer and Library

## Viewer (interim)

There is no real sign-in yet. `lib/authz/viewer.ts` is the only place that learns who is looking:

- `getViewer()` returns the user named by `FORCED_VIEWER_ID` (a user id whose profile exists), or `null`.
- It **fails closed**: the forced user is honoured only on Vercel `preview`/`development` deploys, or locally (no `VERCEL_ENV` and not a production build). On `production`, or any unknown environment, it returns `null` (and logs once). Setting the variable on Vercel Preview exposes that user's library to anyone with the preview URL.
- `requireViewer()` is for pages and layouts: no viewer redirects to `/sign-in`. Server Actions call `getViewer()` and return an error result instead.
- Never put a real id in source. Set it in `.env` (see `.env.example`).

Real Supabase Auth replaces the body of `resolveViewer`; call sites do not change.

## Routes

`/` redirects to `/library` (viewer) or `/sign-in`. `/sign-in` is a placeholder. `/library` lives in the `(app)` group, whose layout enforces `requireViewer()` and renders the top nav.

## Library

`getLibrary(viewerId)` (`lib/authz/library.ts`) loads books, highlights and insights once; `LibraryView` filters, scopes and sorts them in the browser, and mirrors lens/search/scope/hidden to the URL: changing section or scope, or opening the Insight drawer from closed, uses `history.pushState` (so Back/Forward move between views, restored on `popstate`), while typing a search, toggling hidden, switching the drawer to another insight or closing it uses `history.replaceState` (`lens`, `q`, `book`, `highlight`, `insight`, `drawer`, `hidden=1`). `drawer=<insightId>` is the insight open in the Insights-lens drawer, separate from `insight=` (which scopes the Highlights lens); an id that isn't in the library, or a `drawer` on another lens, is ignored, and a hidden insight opens even with Show hidden off. Removed books (`user_books.status='removed'`) are excluded everywhere.

Mutations are Server Actions in `app/(app)/library/actions.ts`: `hideInsightAction` / `restoreInsightAction` (scoped to the viewer's own insights) and `getNoteImageUrlAction` (signed URL, 5 minutes, only for the owner's highlight, requested when the popover opens).
