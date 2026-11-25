import { BookCover } from "@/components/library/BookCover";
import { RelationTile } from "@/components/library/RelationTile";
import { TableHeader } from "@/components/library/TableHeader";
import { formatShortDate } from "@/lib/library/format-date";
import type { LibraryBook } from "@/lib/library/types";

type BooksTableProps = {
  books: LibraryBook[];
  onShowHighlights: (bookId: string) => void;
  onShowInsights: (bookId: string) => void;
};

export function BooksTable({
  books,
  onShowHighlights,
  onShowInsights,
}: BooksTableProps) {
  return (
    <table className="w-full table-fixed border-collapse">
      <TableHeader
        columns={[
          { key: "book", label: "Book", className: "w-[44%]" },
          { key: "last", label: "Last highlight", className: "w-[18%]" },
          { key: "relations", label: "" },
        ]}
      />
      <tbody>
        {books.map((book) => (
          <tr key={book.id} className="border-border border-b align-middle">
            <td className="py-3 pr-4">
              <div className="flex items-center gap-3">
                <BookCover
                  bookId={book.id}
                  title={book.title}
                  src={book.coverImageUrl}
                />
                <div className="min-w-0">
                  <div className="font-serif text-base">{book.title}</div>
                  {book.author ? (
                    <div className="text-ink-secondary text-xs">
                      {book.author}
                    </div>
                  ) : null}
                </div>
              </div>
            </td>
            <td className="py-3 pr-4 text-sm">
              {formatShortDate(book.lastHighlightAt)}
            </td>
            <td className="py-3">
              <div className="flex justify-evenly">
                <RelationTile
                  kind="highlight"
                  count={book.highlightCount}
                  label={`Highlights in ${book.title}`}
                  onSelect={() => onShowHighlights(book.id)}
                />
                <RelationTile
                  kind="insight"
                  count={book.insightCount}
                  label={`Insights from ${book.title}`}
                  onSelect={() => onShowInsights(book.id)}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
