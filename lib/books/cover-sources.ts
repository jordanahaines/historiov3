/**
 * Finds a cover image for a book. Chain, in order: Amazon by ASIN, Open Library
 * by ISBN (print ASINs are ISBN-10s), Open Library title/author search. Returns
 * null when nothing matches; throws never, since a missing cover must not fail
 * an import. Findings behind this order: docs/book-covers.md.
 */
import { z } from "zod";

export type BookCoverQuery = {
  asin: string;
  title: string;
  author?: string | null;
};

export type BookCover = {
  bytes: Uint8Array;
  contentType: string;
  source: "amazon" | "openlibrary-isbn" | "openlibrary-search";
  url: string;
};

const USER_AGENT = "historio-v3-cover-fetch/0.1";
// Amazon answers unknown ASINs with a 43-byte 1x1 GIF, so anything this small
// is a placeholder, not a cover.
const MIN_COVER_BYTES = 2_000;

const searchResponse = z.object({
  docs: z.array(
    z.object({
      title: z.string().optional(),
      cover_i: z.number().optional(),
    }),
  ),
});

function isIsbn10(value: string): boolean {
  return /^\d{9}[\dX]$/.test(value);
}

function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

/** True when at least half of the shorter title's words appear in the other. */
export function titlesMatch(a: string, b: string): boolean {
  const left = new Set(tokens(a));
  const right = tokens(b);
  if (left.size === 0 || right.length === 0) return false;
  const shared = right.filter((token) => left.has(token)).length;
  return shared / Math.min(left.size, right.length) >= 0.5;
}

async function fetchImage(
  url: string,
  source: BookCover["source"],
): Promise<BookCover | null> {
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT } });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < MIN_COVER_BYTES) return null;
  return { bytes, contentType, source, url };
}

async function findOpenLibraryCoverId(
  title: string,
  author: string | null | undefined,
): Promise<number | null> {
  const params = new URLSearchParams({
    title,
    limit: "5",
    fields: "title,cover_i",
  });
  if (author) params.set("author", author);
  const response = await fetch(
    `https://openlibrary.org/search.json?${params}`,
    {
      headers: { "user-agent": USER_AGENT },
    },
  );
  if (!response.ok) return null;
  const parsed = searchResponse.safeParse(await response.json());
  if (!parsed.success) return null;
  const hit = parsed.data.docs.find(
    (doc) => doc.cover_i && doc.title && titlesMatch(doc.title, title),
  );
  return hit?.cover_i ?? null;
}

export async function findBookCover(
  query: BookCoverQuery,
): Promise<BookCover | null> {
  const attempts: Array<() => Promise<BookCover | null>> = [
    () =>
      fetchImage(
        `https://m.media-amazon.com/images/P/${query.asin}.01.LZZZZZZZ.jpg`,
        "amazon",
      ),
    async () =>
      isIsbn10(query.asin)
        ? fetchImage(
            `https://covers.openlibrary.org/b/isbn/${query.asin}-L.jpg?default=false`,
            "openlibrary-isbn",
          )
        : null,
    async () => {
      const coverId = await findOpenLibraryCoverId(query.title, query.author);
      return coverId
        ? fetchImage(
            `https://covers.openlibrary.org/b/id/${coverId}-L.jpg?default=false`,
            "openlibrary-search",
          )
        : null;
    },
  ];

  for (const attempt of attempts) {
    try {
      const cover = await attempt();
      if (cover) return cover;
    } catch (error) {
      // Network or parse failure on one source: fall through to the next.
      console.warn("Cover source failed", error);
    }
  }
  return null;
}
