import { NoteImagePopover } from "@/components/library/NoteImagePopover";
import type { NoteUrlResult } from "@/components/library/library-actions";
import type { LibraryHighlight } from "@/lib/library/types";

type DrawerHighlightProps = {
  highlight: LibraryHighlight;
  bookTitle: string;
  getNoteImageUrl: (highlightId: string) => Promise<NoteUrlResult>;
};

/** One highlight behind an insight: the quote, its source, and any handwritten note. */
export function DrawerHighlight({
  highlight,
  bookTitle,
  getNoteImageUrl,
}: DrawerHighlightProps) {
  return (
    <li className="border-border border-t py-3 first:border-t-0">
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
      <p className="text-ink-muted mt-1 text-xs">
        {bookTitle}
        {highlight.page !== null ? ` · p. ${highlight.page}` : ""}
      </p>
      {highlight.noteText ? (
        <p className="font-hand text-note mt-1 text-[17px]">
          {highlight.noteText}
        </p>
      ) : null}
    </li>
  );
}
