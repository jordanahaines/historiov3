import { NoteImagePopover } from "@/components/library/NoteImagePopover";
import type { NoteUrlResult } from "@/components/library/library-actions";
import { formatShortDate } from "@/lib/library/format-date";
import { highlightStatusLabel } from "@/lib/library/status-label";
import type { LibraryHighlight } from "@/lib/library/types";

type HighlightRowProps = {
  highlight: LibraryHighlight;
  onShowInsights: (highlight: LibraryHighlight) => void;
  getNoteImageUrl: (highlightId: string) => Promise<NoteUrlResult>;
};

const MAX_LINKS = 2;

export function HighlightRow({
  highlight,
  onShowInsights,
  getNoteImageUrl,
}: HighlightRowProps) {
  const status = highlightStatusLabel(highlight.status);
  const shown = highlight.insights.slice(0, MAX_LINKS);
  const more = highlight.insights.length - shown.length;

  return (
    <tr className="border-border border-b align-top">
      <td className="py-3 pr-4">
        <p className="font-serif text-base">
          {highlight.text}
          {highlight.hasNoteImage ? (
            <NoteImagePopover
              highlightId={highlight.id}
              page={highlight.page}
              getNoteImageUrl={getNoteImageUrl}
            />
          ) : null}
        </p>
        {highlight.noteText ? (
          <p className="font-hand text-note mt-1 text-[17px]">
            {highlight.noteText}
          </p>
        ) : null}
      </td>
      <td className="py-3 pr-4 text-sm">
        {shown.length === 0 ? (
          <span className="text-ink-muted">None yet</span>
        ) : (
          <div className="flex flex-col items-start gap-1">
            {shown.map((insight) => (
              <button
                key={insight.id}
                type="button"
                onClick={() => onShowInsights(highlight)}
                className="text-link focus-visible:outline-link text-left hover:underline focus-visible:outline-2"
              >
                {insight.title} →
              </button>
            ))}
            {more > 0 ? (
              <button
                type="button"
                onClick={() => onShowInsights(highlight)}
                className="text-ink-muted focus-visible:outline-link hover:underline focus-visible:outline-2"
              >
                +{more} more
              </button>
            ) : null}
          </div>
        )}
      </td>
      <td
        className={`py-3 pr-4 text-sm ${status.muted ? "text-ink-muted" : "text-ink-secondary"}`}
      >
        {status.label}
      </td>
      <td className="py-3 text-sm whitespace-nowrap">
        {formatShortDate(highlight.capturedAt)}
      </td>
    </tr>
  );
}
