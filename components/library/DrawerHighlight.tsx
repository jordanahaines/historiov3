import { BookCover } from "@/components/library/BookCover";
import { NoteImagePopover } from "@/components/library/NoteImagePopover";
import type { NoteUrlResult } from "@/components/library/library-actions";
import type { LibraryBook, LibraryHighlight } from "@/lib/library/types";

type DrawerHighlightProps = {
  highlight: LibraryHighlight;
  book: LibraryBook | undefined;
  getNoteImageUrl: (highlightId: string) => Promise<NoteUrlResult>;
};

/**
 * One highlight behind an insight: a book thumbnail the text wraps around, the
 * quote marked like a highlighter pen, and any handwritten note.
 */
export function DrawerHighlight({
  highlight,
  book,
  getNoteImageUrl,
}: DrawerHighlightProps) {
  return (
    <li className="border-border-strong flow-root border-l-2 pl-3">
      <span className="float-left mt-[3px] mr-2">
        <BookCover
          size="small"
          bookId={highlight.bookId}
          title={book?.title ?? ""}
          src={book?.coverImageUrl ?? null}
        />
      </span>
      <p className="font-serif text-sm leading-[1.6] italic">
        <span className="marker-highlight">{highlight.text}</span>
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
    </li>
  );
}
