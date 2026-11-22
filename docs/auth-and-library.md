# Viewer and Library

## Viewer (interim)

There is no real sign-in yet. `lib/authz/viewer.ts` is the only place that learns who is looking:

- `getViewer()` returns the user named by `FORCED_VIEWER_ID` (a user id whose profile exists), or `null`.
- It **always returns `null` when `VERCEL_ENV=production`** (and logs once), so a forced user's data is never shown on production. Preview and local deployments honour it, so setting the variable on Vercel Preview exposes that user's library to anyone with the preview URL.
- `requireViewer()` is for pages and layouts: no viewer redirects to `/sign-in`. Server Actions call `getViewer()` and return an error result instead.
- Never put a real id in source. Set it in `.env` (see `.env.example`).

Real Supabase Auth replaces the body of `resolveViewer`; call sites do not change.

## Routes

`/` redirects to `/library` (viewer) or `/sign-in`. `/sign-in` is a placeholder. `/library` lives in the `(app)` group, whose layout enforces `requireViewer()` and renders the top nav.

## Library

`getLibrary(viewerId)` (`lib/authz/library.ts`) loads books, highlights and insights once; `LibraryView` filters, scopes and sorts them in the browser, and mirrors lens/search/scope/hidden to the URL with `history.replaceState` (`lens`, `q`, `book`, `highlight`, `hidden=1`). Removed books (`user_books.status='removed'`) are excluded everywhere.

Mutations are Server Actions in `app/(app)/library/actions.ts`: `hideInsightAction` / `restoreInsightAction` (scoped to the viewer's own insights) and `getNoteImageUrlAction` (signed URL, 5 minutes, only for the owner's highlight, requested when the popover opens).
