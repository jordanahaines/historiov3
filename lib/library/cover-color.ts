// Muted paper-friendly tones for books without a cover image.
const COVER_COLORS = [
  "#D9CBB0",
  "#CBD3C0",
  "#C5CFDA",
  "#DCC3BA",
  "#D3C7D8",
  "#D8D2B4",
  "#BFD0CE",
  "#DDC9A5",
] as const;

/** Deterministic placeholder color for a book, from its id. */
export function coverColor(bookId: string): string {
  let hash = 0;
  for (const char of bookId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COVER_COLORS[hash % COVER_COLORS.length];
}
