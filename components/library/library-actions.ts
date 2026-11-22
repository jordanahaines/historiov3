/** The Server Actions the Library view calls, as a type so tests can mock them. */
export type ActionResult = { ok: true } | { ok: false; error: string };
export type NoteUrlResult =
  { ok: true; url: string } | { ok: false; error: string };

export type LibraryActions = {
  hideInsight: (insightId: string) => Promise<ActionResult>;
  restoreInsight: (insightId: string) => Promise<ActionResult>;
  getNoteImageUrl: (highlightId: string) => Promise<NoteUrlResult>;
};
