import type { InsightStatus, LibraryData } from "@/lib/library/types";

/**
 * Applies a hide/restore to the loaded library so every number and list that
 * depends on it stays right without a refetch: the insight's status, each
 * linked book's published-insight count, and each linked highlight's insight
 * list. Pure, so a failed action rolls back by applying the opposite status.
 */
export function applyInsightStatus(
  data: LibraryData,
  insightId: string,
  status: InsightStatus,
): LibraryData {
  const insight = data.insights.find((i) => i.id === insightId);
  if (!insight || insight.status === status) return data;

  const delta = status === "published" ? 1 : -1;
  const linkedBooks = new Set(insight.bookIds);
  const linkedHighlights = new Set(insight.highlightIds);

  return {
    insights: data.insights.map((i) =>
      i.id === insightId ? { ...i, status } : i,
    ),
    books: data.books.map((book) =>
      linkedBooks.has(book.id)
        ? { ...book, insightCount: Math.max(0, book.insightCount + delta) }
        : book,
    ),
    highlights: data.highlights.map((highlight) => {
      if (!linkedHighlights.has(highlight.id)) return highlight;
      const without = highlight.insights.filter((i) => i.id !== insightId);
      return {
        ...highlight,
        insights:
          status === "published"
            ? [...without, { id: insightId, title: insight.title }].sort(
                (a, b) => a.title.localeCompare(b.title),
              )
            : without,
      };
    }),
  };
}
