import { periodValues } from "@/lib/insights/period";
import type {
  LibraryBook,
  LibraryData,
  LibraryHighlight,
  LibraryInsight,
  Scope,
} from "@/lib/library/types";

export type SortDirection = "asc" | "desc";

const norm = (value: string | null | undefined) => (value ?? "").toLowerCase();

/** Case-insensitive substring match against any of the fields. */
function matches(query: string, fields: (string | null | undefined)[]) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => norm(field).includes(needle));
}

/** Books by title or author; newest last highlight first, never-highlighted last. */
export function filterBooks(
  books: LibraryBook[],
  query: string,
): LibraryBook[] {
  return books
    .filter((book) => matches(query, [book.title, book.author]))
    .sort((a, b) => {
      if (a.lastHighlightAt === b.lastHighlightAt) return 0;
      if (a.lastHighlightAt === null) return 1;
      if (b.lastHighlightAt === null) return -1;
      return a.lastHighlightAt < b.lastHighlightAt ? 1 : -1;
    });
}

/** Highlights by text, note or linked insight title; newest captured first. */
export function filterHighlights(
  highlights: LibraryHighlight[],
  query: string,
  scope: Scope,
): LibraryHighlight[] {
  return highlights
    .filter((highlight) => !scope.bookId || highlight.bookId === scope.bookId)
    .filter(
      (highlight) =>
        !scope.insightHighlightIds ||
        scope.insightHighlightIds.includes(highlight.id),
    )
    .filter((highlight) =>
      matches(query, [
        highlight.text,
        highlight.noteText,
        ...highlight.insights.map((insight) => insight.title),
      ]),
    )
    .sort((a, b) =>
      a.capturedAt === b.capturedAt ? 0 : a.capturedAt < b.capturedAt ? 1 : -1,
    );
}

/**
 * Insights by title, alias, description or area name, scoped to a book or a
 * highlight, sorted by period start. Hidden ones only when `showHidden`.
 */
export function filterInsights(
  insights: LibraryInsight[],
  query: string,
  scope: Scope,
  options: { showHidden: boolean; direction: SortDirection },
): LibraryInsight[] {
  const sign = options.direction === "asc" ? 1 : -1;
  return insights
    .filter((insight) => options.showHidden || insight.status === "published")
    .filter(
      (insight) => !scope.bookId || insight.bookIds.includes(scope.bookId),
    )
    .filter(
      (insight) =>
        !scope.highlightId || insight.highlightIds.includes(scope.highlightId),
    )
    .filter((insight) =>
      matches(query, [
        insight.title,
        ...insight.aliases,
        insight.description,
        insight.locationName,
      ]),
    )
    .sort(
      (a, b) =>
        sign * (periodValues(a.period).start - periodValues(b.period).start),
    );
}

/** Totals shown next to the section menu: published insights only. */
export function sectionCounts(data: LibraryData) {
  return {
    books: data.books.length,
    highlights: data.highlights.length,
    insights: data.insights.filter((i) => i.status === "published").length,
  };
}

export function hiddenCount(insights: LibraryInsight[]): number {
  return insights.filter((insight) => insight.status === "hidden").length;
}
