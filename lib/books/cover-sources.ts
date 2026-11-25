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
// A stalled third-party host must not hang an import.
const FETCH_TIMEOUT_MS = 10_000;
const MAX_COVER_BYTES = 5_000_000;

export const COVER_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

function fetchWithTimeout(url: string): Promise<Response> {
  return fetch(url, {
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}
// Amazon answers unknown ASINs with a 43-byte 1x1 GIF, so anything this small
// is a placeholder, not a cover.
const MIN_COVER_BYTES = 2_000;

const searchResponse = z.object({
  docs: z.array(
    z.object({
      title: z.string().optional(),
      author_name: z.array(z.string()).optional(),
      cover_i: z.number().optional(),
    }),
  ),
});

function isIsbn10(value: string): boolean {
  return /^\d{9}[\dX]$/.test(value);
}

// Short common words carry no signal: "The Great War" must not match
// "The Great Gatsby" because of "the".
const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
]);

function tokens(value: string, dropStopwords = true): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N} ]/gu, " ")
      .split(/\s+/)
      .filter(
        (token) => token.length > 2 && !(dropStopwords && STOPWORDS.has(token)),
      ),
  );
}

/**
 * True when every significant word of the shorter title appears in the other,
 * so a subtitle may differ ("SPQR" vs "SPQR: A History of Ancient Rome") but a
 * half-overlap may not.
 */
export function titlesMatch(a: string, b: string): boolean {
  const left = tokens(a);
  const right = tokens(b);
  if (left.size === 0 || right.size === 0) return false;
  const [shorter, longer] =
    left.size <= right.size ? [left, right] : [right, left];
  return [...shorter].every((token) => longer.has(token));
}

/** True when the query author shares a name part with any listed author. */
export function authorsMatch(
  queryAuthor: string,
  candidates: string[],
): boolean {
  const wanted = tokens(queryAuthor, false);
  return candidates.some((candidate) =>
    [...tokens(candidate, false)].some((token) => wanted.has(token)),
  );
}

async function fetchImage(
  url: string,
  source: BookCover["source"],
): Promise<BookCover | null> {
  const response = await fetchWithTimeout(url);
  if (!response.ok) return null;
  const contentType = (response.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim();
  if (!(contentType in COVER_EXTENSIONS)) return null;
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_COVER_BYTES) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength < MIN_COVER_BYTES || bytes.byteLength > MAX_COVER_BYTES)
    return null;
  return { bytes, contentType, source, url };
}

async function findOpenLibraryCoverId(
  title: string,
  author: string | null | undefined,
): Promise<number | null> {
  const params = new URLSearchParams({
    title,
    limit: "5",
    fields: "title,author_name,cover_i",
  });
  if (author) params.set("author", author);
  const response = await fetchWithTimeout(
    `https://openlibrary.org/search.json?${params}`,
  );
  if (!response.ok) return null;
  const parsed = searchResponse.safeParse(await response.json());
  if (!parsed.success) return null;
  const hit = parsed.data.docs.find(
    (doc) =>
      doc.cover_i &&
      doc.title &&
      titlesMatch(doc.title, title) &&
      // Only enforce the author when both sides know one.
      (!author || !doc.author_name || authorsMatch(author, doc.author_name)),
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
