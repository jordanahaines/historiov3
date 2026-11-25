import { NoteImagePopover } from "@/components/library/NoteImagePopover";
import { StatusSteps } from "@/components/library/StatusSteps";
import type { NoteUrlResult } from "@/components/library/library-actions";
import { formatDate } from "@/lib/library/format-date";
import type { LibraryHighlight } from "@/lib/library/types";

type HighlightRowProps = {
  highlight: LibraryHighlight;
  selected?: boolean;
  onOpen: (highlightId: string) => void;
  onShowInsights: (highlight: LibraryHighlight) => void;
  getNoteImageUrl: (highlightId: string) => Promise<NoteUrlResult>;
};

const MAX_LINKS = 2;

export function HighlightRow({
  highlight,
  selected = false,
  onOpen,
  onShowInsights,
  getNoteImageUrl,
}: HighlightRowProps) {
  const shown = highlight.insights.slice(0, MAX_LINKS);
  const more = highlight.insights.length - shown.length;

  return (
    <tr
      data-drawer-row={highlight.id}
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={(event) => {
        // Links and the note popover inside the row handle their own clicks.
        if ((event.target as Element).closest("button, [role=dialog]")) return;
        onOpen(highlight.id);
      }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(highlight.id);
        }
      }}
      className={`border-border focus-visible:outline-link cursor-pointer border-b align-top focus-visible:outline-2 ${
        selected ? "bg-wash/50" : ""
      }`}
    >
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
      <td className="py-3 pr-4">
        <StatusSteps status={highlight.status} />
      </td>
      <td className="py-3 text-sm whitespace-nowrap">
        {formatDate(highlight.capturedAt)}
      </td>
    </tr>
  );
}
