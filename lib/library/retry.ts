import type { HighlightStatus, LibraryData } from "@/lib/library/types";

/** A `pending` / `contextualized` highlight unchanged this long is stalled. */
export const STALLED_AFTER_MINUTES = 10;
export const STALLED_AFTER_MS = STALLED_AFTER_MINUTES * 60_000;

/** True once the pipeline will not move this highlight again by itself. */
export function isTerminalStatus(status: HighlightStatus): boolean {
  return (
    status === "researched" || status === "discarded" || status === "failed"
  );
}

/**
 * Whether the Library offers Retry. `now` is null before the browser clock is
 * known (server render and hydration), when only `failed` qualifies. The server
 * re-checks the same rule when it claims the retry.
 */
export function canRetryHighlight(
  highlight: { status: HighlightStatus; updatedAt: string },
  now: number | null,
): boolean {
  if (highlight.status === "failed") return true;
  if (isTerminalStatus(highlight.status) || now === null) return false;
  return now - Date.parse(highlight.updatedAt) >= STALLED_AFTER_MS;
}

/** One highlight's new pipeline status in the loaded library. */
export function applyHighlightStatus(
  data: LibraryData,
  highlightId: string,
  status: HighlightStatus,
  updatedAt: string,
): LibraryData {
  return {
    ...data,
    highlights: data.highlights.map((highlight) =>
      highlight.id === highlightId
        ? { ...highlight, status, updatedAt }
        : highlight,
    ),
  };
}
