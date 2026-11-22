import type { PeriodParts } from "@/lib/insights/period";

export type Lens = "books" | "highlights" | "insights";

export type InsightType = "event" | "person" | "place" | "concept";
export type InsightStatus = "published" | "hidden";
export type HighlightStatus =
  "pending" | "contextualized" | "researched" | "discarded" | "failed";

export type LibraryBook = {
  id: string;
  title: string;
  author: string | null;
  coverImageUrl: string | null;
  /** ISO timestamp of the most recent highlight (annotated, else created). */
  lastHighlightAt: string | null;
  highlightCount: number;
  /** Published insights linked to at least one of this book's highlights. */
  insightCount: number;
};

export type LibraryHighlight = {
  id: string;
  bookId: string;
  text: string;
  noteText: string | null;
  hasNoteImage: boolean;
  page: number | null;
  status: HighlightStatus;
  /** ISO timestamp: annotated_at, falling back to created_at. */
  capturedAt: string;
  /** Published insights this highlight feeds. */
  insights: { id: string; title: string }[];
};

export type LibraryInsight = {
  id: string;
  type: InsightType;
  status: InsightStatus;
  title: string;
  aliases: string[];
  description: string | null;
  locationName: string | null;
  period: PeriodParts;
  highlightCount: number;
  highlightIds: string[];
  bookIds: string[];
};

export type LibraryData = {
  books: LibraryBook[];
  highlights: LibraryHighlight[];
  insights: LibraryInsight[];
};

/** What the Library is scoped to, set only by relation links. */
export type Scope = {
  bookId?: string;
  highlightId?: string;
  /** Show only these highlights (the ones behind one insight). */
  insightHighlightIds?: string[];
};
