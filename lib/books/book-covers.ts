/**
 * Finds a cover for a catalog book and stores it: bytes go to the public
 * `book-covers` bucket, the public URL to `books.cover_image_url`. Never
 * throws — a missing cover must not fail an import (docs/book-covers.md).
 */
import { setBookCoverIfMissing } from "@/lib/authz/books";
import { uploadBookCover } from "@/lib/storage/buckets";

import { COVER_EXTENSIONS, findBookCover } from "./cover-sources";

export type CoverTarget = {
  id: string;
  asin: string | null;
  title: string;
  author: string | null;
};

// The ASIN becomes a Storage object path, so only accept its known shape.
const ASIN_PATTERN = /^[A-Z0-9]{10}$/i;

/** Returns the stored cover URL, or null if none was found or storing failed. */
export async function ensureBookCover(
  book: CoverTarget,
): Promise<string | null> {
  if (!book.asin || !ASIN_PATTERN.test(book.asin)) return null;
  try {
    const cover = await findBookCover({
      asin: book.asin,
      title: book.title,
      author: book.author,
    });
    if (!cover) return null;
    const url = await uploadBookCover(
      book.asin,
      COVER_EXTENSIONS[cover.contentType],
      cover.bytes,
      cover.contentType,
    );
    await setBookCoverIfMissing(book.id, url);
    return url;
  } catch (error) {
    console.warn(`Cover for ${book.asin} failed`, error);
    return null;
  }
}
