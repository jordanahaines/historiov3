import { InsightRow } from "@/components/library/InsightRow";
import { TableHeader } from "@/components/library/TableHeader";
import type { SortDirection } from "@/lib/library/filter";
import type { LibraryInsight } from "@/lib/library/types";

type InsightsTableProps = {
  insights: LibraryInsight[];
  direction: SortDirection;
  errors: Record<string, string>;
  /** The insight open in the drawer, highlighted in the table. */
  selectedId: string | null;
  onOpen: (insightId: string) => void;
  onToggleSort: () => void;
  onShowHighlights: (insightId: string) => void;
  onHide: (id: string) => void;
  onRestore: (id: string) => void;
};

export function InsightsTable({
  insights,
  direction,
  errors,
  selectedId,
  onOpen,
  onToggleSort,
  onShowHighlights,
  onHide,
  onRestore,
}: InsightsTableProps) {
  return (
    <table className="w-full table-fixed border-collapse">
      <TableHeader
        columns={[
          { key: "title", label: "Title", className: "w-[26%]" },
          { key: "description", label: "Description", className: "w-[34%]" },
          {
            key: "period",
            label: "Period",
            className: "w-[14%]",
            sort: { direction, onToggle: onToggleSort },
          },
          { key: "area", label: "Area", className: "w-[8%]" },
          { key: "actions", label: "Actions", className: "w-[10%]" },
        ]}
      />
      <tbody>
        {insights.map((insight) => (
          <InsightRow
            key={insight.id}
            insight={insight}
            error={errors[insight.id]}
            selected={insight.id === selectedId}
            onOpen={onOpen}
            onShowHighlights={onShowHighlights}
            onHide={onHide}
            onRestore={onRestore}
          />
        ))}
      </tbody>
    </table>
  );
}
