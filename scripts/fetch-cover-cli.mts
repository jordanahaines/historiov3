/**
 * Looks up a cover for one book and saves it to a local file. Read-only: it
 * never writes to the database or Storage, and costs no LLM money.
 *
 *   pnpm book:cover <asin> [--title "…"] [--author "…"] [--out path]
 *
 * Title and author come from the books table when the ASIN is in the catalog;
 * pass them explicitly for a book that is not (or to override).
 */
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { books } from "@/lib/db/schema";
import { findBookCover } from "@/lib/books/cover-sources";

import { log } from "./lib/log.mjs";

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      title: { type: "string" },
      author: { type: "string" },
      out: { type: "string" },
    },
  });
  const asin = positionals[0];
  if (!asin) {
    throw new Error(
      'Usage: pnpm book:cover <asin> [--title "…"] [--author "…"] [--out path]',
    );
  }

  let title = values.title;
  let author = values.author;
  if (!title) {
    const [book] = await db
      .select({ title: books.title, author: books.author })
      .from(books)
      .where(eq(books.asin, asin))
      .limit(1);
    if (!book) {
      throw new Error(`ASIN ${asin} is not in the catalog; pass --title.`);
    }
    title = book.title;
    author ??= book.author ?? undefined;
  }

  log(`Looking for a cover for "${title}" (${asin})…`);
  const cover = await findBookCover({ asin, title, author });
  if (!cover) {
    process.exitCode = 1;
    log("No cover found. The placeholder color block would be used.");
    return;
  }

  const extension = EXTENSIONS[cover.contentType.split(";")[0]] ?? "img";
  const out = values.out ?? `tmp/covers/${asin}.${extension}`;
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, cover.bytes);
  log(
    `Found via ${cover.source} (${cover.bytes.byteLength} bytes, ${cover.contentType}).`,
  );
  log(`Source URL: ${cover.url}`);
  log(`Saved to ${out}`);
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
