/**
 * Fetches covers for catalog books that have none, stores them in the public
 * `book-covers` bucket and sets `books.cover_image_url`. No LLM cost; it does
 * write to Storage and the database, and only touches books with a null cover.
 * Safe to re-run.
 *
 *   pnpm books:backfill-covers [--dry-run] [--limit N] [--delay-ms 1500]
 *
 * --dry-run only lists the books it would try. The delay between books keeps
 * us under Open Library's per-IP rate limit.
 */
import "dotenv/config";
import { parseArgs } from "node:util";

import { listBooksWithoutCover } from "@/lib/authz/books";
import { ensureBookCover } from "@/lib/books/book-covers";

import { log } from "./lib/log.mjs";

async function main() {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      limit: { type: "string" },
      "delay-ms": { type: "string", default: "1500" },
    },
  });
  const limit = values.limit ? Number(values.limit) : undefined;
  const delayMs = Number(values["delay-ms"]);
  if (
    (limit !== undefined && !(limit > 0)) ||
    !Number.isFinite(delayMs) ||
    delayMs < 0
  ) {
    throw new Error("--limit must be positive and --delay-ms non-negative.");
  }

  const pending = await listBooksWithoutCover(limit);
  log(`${pending.length} book(s) without a cover.`);

  let found = 0;
  for (const [index, book] of pending.entries()) {
    const label = `${index + 1}/${pending.length} "${book.title}" (${book.asin})`;
    if (values["dry-run"]) {
      log(`Would try ${label}`);
      continue;
    }
    const url = await ensureBookCover(book);
    if (url) found += 1;
    log(`${url ? "Stored" : "No cover for"} ${label}${url ? ` → ${url}` : ""}`);
    if (index < pending.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  if (!values["dry-run"]) {
    log(`Done: ${found} stored, ${pending.length - found} without a cover.`);
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
