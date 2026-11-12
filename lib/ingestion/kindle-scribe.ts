import { createHash } from "node:crypto";

import {
  parseNotebook,
  transcribeNotes,
  type HighlightRecord,
  type ParsedNotebook,
  type TranscribeOptions,
} from "historio-kindle-scribe-notes-parser";

import { ensureUserBook, findOrCreateBookByAsin } from "@/lib/authz/books";
import {
  createHighlights,
  findExistingExternalIds,
  type NewHighlightInput,
} from "@/lib/authz/highlights";
import { uploadNoteScan } from "@/lib/storage/buckets";

/** Parses notebook PDF bytes (the one place steps reach the parser package). */
export const parseScribeNotebook = parseNotebook;

export const KINDLE_SCRIBE_SOURCE = "kindle_scribe" as const;

export type SaveNewHighlightsInput = {
  userId: string;
  /** Set when the import came from an email; ties highlights to the event. */
  ingestionEventId: string | null;
  /** Only used when this book hasn't been seen before. */
  coverImageUrl?: string;
  /** Required only if the batch has new handwritten notes (unless precomputed). */
  transcribeOptions?: TranscribeOptions;
  /** Skip live transcription and use these, keyed by external id. */
  precomputedTranscriptions?: Map<string, string>;
  /** Skip uploading note scans (text is still saved). For dry runs. */
  skipMediaUpload?: boolean;
};

export type SaveNewHighlightsSummary = {
  bookId: string;
  bookCreated: boolean;
  highlightsFound: number;
  highlightsSaved: number;
  highlightsSkippedAsDuplicate: number;
};

/** `p<page>-<sha256(highlightedText)>` — the Scribe dedup key. */
export function externalIdFor(highlight: HighlightRecord): string {
  const hash = createHash("sha256").update(highlight.text).digest("hex");
  return `p${highlight.page}-${hash}`;
}

/**
 * Lands one parsed Scribe notebook into a user's `highlights` (deduped) and
 * puts the book in their library. Safe to re-run for the same notebook: only
 * highlights whose key is new are transcribed, uploaded and inserted. Does not
 * start any processing — highlights are saved `pending`.
 */
export async function saveNewHighlights(
  parsed: ParsedNotebook,
  input: SaveNewHighlightsInput,
): Promise<SaveNewHighlightsSummary> {
  const { book, created: bookCreated } = await findOrCreateBookByAsin({
    asin: parsed.book.asin,
    title: parsed.book.title,
    author: parsed.book.author,
    coverImageUrl: input.coverImageUrl,
  });
  // Must exist before any highlight insert (highlights FK to user_books).
  await ensureUserBook(input.userId, book.id);

  const candidates = parsed.highlights.map((highlight) => ({
    highlight,
    externalId: externalIdFor(highlight),
  }));

  const existingIds = await findExistingExternalIds(
    input.userId,
    book.id,
    KINDLE_SCRIBE_SOURCE,
    candidates.map((candidate) => candidate.externalId),
  );
  const newCandidates = candidates.filter(
    (candidate) => !existingIds.has(candidate.externalId),
  );

  const notesToTranscribe = newCandidates.flatMap((candidate) => {
    const note = candidate.highlight.note;
    return note?.type === "handwritten"
      ? [{ id: candidate.externalId, image: note.image }]
      : [];
  });

  let transcriptions = new Map<string, string>();
  if (input.precomputedTranscriptions) {
    const missing = notesToTranscribe
      .map((note) => note.id)
      .filter((id) => !input.precomputedTranscriptions!.has(id));
    if (missing.length > 0) {
      throw new Error(
        `precomputedTranscriptions is missing ${missing.length} handwritten note(s): ${missing.join(", ")}`,
      );
    }
    transcriptions = input.precomputedTranscriptions;
  } else if (notesToTranscribe.length > 0) {
    if (!input.transcribeOptions) {
      throw new Error(
        "transcribeOptions is required: this batch includes new highlights with handwritten notes",
      );
    }
    const results = await transcribeNotes(
      notesToTranscribe,
      [],
      input.transcribeOptions,
    );
    transcriptions = new Map(
      results.map((result) => [result.id, result.transcription]),
    );
  }

  // Scans go up before the rows are inserted, so a retry after a crash never
  // leaves a saved highlight without its scan (uploads are upserts).
  const scanPaths = new Map<string, string>();
  if (!input.skipMediaUpload) {
    for (const candidate of newCandidates) {
      const note = candidate.highlight.note;
      if (note?.type !== "handwritten") continue;
      scanPaths.set(
        candidate.externalId,
        await uploadNoteScan(input.userId, candidate.externalId, note.image),
      );
    }
  }

  const newHighlightInputs: NewHighlightInput[] = newCandidates.map(
    ({ highlight, externalId }) => {
      const note = highlight.note;
      const noteText =
        note?.type === "typed"
          ? note.text
          : note?.type === "handwritten"
            ? (transcriptions.get(externalId) ?? null)
            : null;
      return {
        userId: input.userId,
        bookId: book.id,
        ingestionEventId: input.ingestionEventId,
        source: KINDLE_SCRIBE_SOURCE,
        externalId,
        page: highlight.page,
        chapter: highlight.chapter,
        highlightedText: highlight.text,
        noteText,
        noteOrigin: note?.type ?? null,
        noteImagePath: scanPaths.get(externalId) ?? null,
        annotatedAt: highlight.date,
      };
    },
  );

  const saved = await createHighlights(newHighlightInputs);

  return {
    bookId: book.id,
    bookCreated,
    highlightsFound: candidates.length,
    highlightsSaved: saved.length,
    highlightsSkippedAsDuplicate: candidates.length - saved.length,
  };
}
