import { HighlightRow } from "@/components/library/HighlightRow";
import { TableHeader } from "@/components/library/TableHeader";
import type { NoteUrlResult } from "@/components/library/library-actions";
import type { LibraryHighlight } from "@/lib/library/types";

type HighlightsTableProps = {
  highlights: LibraryHighlight[];
  onShowInsights: (highlight: LibraryHighlight) => void;
  getNoteImageUrl: (highlightId: string) => Promise<NoteUrlResult>;
};

export function HighlightsTable({
  highlights,
  onShowInsights,
  getNoteImageUrl,
}: HighlightsTableProps) {
  return (
    <table className="w-full table-fixed border-collapse">
      <TableHeader
        columns={[
          { key: "highlight", label: "Highlight", className: "w-[52%]" },
          { key: "insights", label: "Insights", className: "w-[24%]" },
          { key: "status", label: "Status", className: "w-[12%]" },
          { key: "captured", label: "Captured" },
        ]}
      />
      <tbody>
        {highlights.map((highlight) => (
          <HighlightRow
            key={highlight.id}
            highlight={highlight}
            onShowInsights={onShowInsights}
            getNoteImageUrl={getNoteImageUrl}
          />
        ))}
      </tbody>
    </table>
  );
}
