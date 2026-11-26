import type { HighlightStatus, LibraryData } from "@/lib/library/types";

export type HighlightStatusResult =
  | { ok: true; status: HighlightStatus; updatedAt: string }
  | { ok: false; error: string };
export type RefreshLibraryResult =
  { ok: true; data: LibraryData } | { ok: false; error: string };

/** The Server Actions the Library view calls, as a type so tests can mock them. */
export type ActionResult = { ok: true } | { ok: false; error: string };
export type NoteUrlResult =
  { ok: true; url: string } | { ok: false; error: string };

export type LibraryActions = {
  hideInsight: (insightId: string) => Promise<ActionResult>;
  restoreInsight: (insightId: string) => Promise<ActionResult>;
  getNoteImageUrl: (highlightId: string) => Promise<NoteUrlResult>;
  retryHighlight: (highlightId: string) => Promise<HighlightStatusResult>;
  getHighlightStatus: (highlightId: string) => Promise<HighlightStatusResult>;
  refreshLibrary: () => Promise<RefreshLibraryResult>;
};
