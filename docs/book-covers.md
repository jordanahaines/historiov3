# Book covers

Spike result: where covers come from and how to store them. Tested 2026-11-22
against 25 books (the 2 in the dev DB plus 23 more: Kindle-only `B0…` ASINs,
print ISBN-10 ASINs, non-English, recent and obscure titles).

Try it: `pnpm book:cover <asin> [--title "…"] [--author "…"] [--out path]`
(read-only; saves to `tmp/covers/`). The chain lives in
`lib/books/cover-sources.ts`.

## Results

| Source                                                      | Hits  | Notes                                                                                                                             |
| ----------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------- |
| Amazon `m.media-amazon.com/images/P/<ASIN>.01.LZZZZZZZ.jpg` | 23/25 | Works for both Kindle `B0…` and print ASINs. Both DB books hit. ~300×500. Unknown ASINs return a 1×1 GIF (200 OK), so check size. |
| Open Library by ISBN                                        | 18/20 | Print ASINs only (ISBN-10). ~300×475–500.                                                                                         |
| Open Library title/author search → cover                    | 21/25 | Works for Kindle-only ASINs, but needs a title-match check; one hit returned a 118×180 image.                                     |
| Google Books                                                | n/a   | Keyless quota was already exhausted (HTTP 429), so it needs an API key. Not tested.                                               |
| Chain Amazon → OL ISBN → OL search                          | 24/25 | Misses only on one obscure title. Without Amazon, OL alone gets 23/25.                                                            |

The two misses for Amazon (Project Hail Mary, The Pursuit of the Millennium)
may be ASINs mistyped in the test set; Open Library found the first by search.

## Recommendation

- **Source:** the chain above. No new dependency, no API key.
- **When:** in the import step when `findOrCreateBookByAsin` returns
  `created: true`. Wrap it in try/catch (`findBookCover` already returns null
  rather than throwing); a missing cover never fails an import.
- **Storage:** copy the bytes into a new **public** `book-covers` bucket at
  `<asin>.<ext>` and store the public URL in `books.cover_image_url`. Covers
  are shared by all users and are not secret. Copying avoids per-view calls to
  third parties and survives upstream URL changes.
- **Fallback:** leave `cover_image_url` null; `BookCover` already renders a
  generated color block. Retry later through a backfill command (null covers
  only), not on every view.
- **Rights (decision needed):** book covers are publisher copyright. Amazon's
  image CDN is unofficial and its terms do not grant us copying. Open Library
  serves covers for reuse but does not warrant rights to each image. I did not
  read the terms pages during this spike, so treat this as a risk to confirm,
  not a clearance. Hotlinking instead avoids copying, but leaks viewer
  requests and breaks when URLs change.
- **Rate limits:** Open Library throttles ISBN and search lookups per IP (I
  recall about 100 per 5 minutes, unverified). Fine for one fetch per new
  book; a bulk backfill should pace itself.
