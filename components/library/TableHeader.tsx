import { MarkerRule } from "@/components/library/MarkerRule";

export type TableColumn = {
  key: string;
  label: string;
  /** Set for the one sortable column. */
  sort?: { direction: "asc" | "desc"; onToggle: () => void };
  className?: string;
};

type TableHeaderProps = { columns: TableColumn[] };

/** Bold ink header text over the hand-drawn marker rule. */
export function TableHeader({ columns }: TableHeaderProps) {
  return (
    <thead className="bg-paper sticky top-0 z-10">
      <tr>
        {columns.map((column) => (
          <th
            key={column.key}
            scope="col"
            aria-sort={
              column.sort
                ? column.sort.direction === "asc"
                  ? "ascending"
                  : "descending"
                : undefined
            }
            className={`text-ink pb-2 text-left text-sm font-bold ${column.className ?? ""}`}
          >
            {column.sort ? (
              <button
                type="button"
                onClick={column.sort.onToggle}
                className="focus-visible:outline-link inline-flex items-center gap-1 font-bold focus-visible:outline-2"
              >
                {column.label}
                <span aria-hidden="true">
                  {column.sort.direction === "asc" ? "↑" : "↓"}
                </span>
              </button>
            ) : (
              column.label
            )}
          </th>
        ))}
      </tr>
      <tr aria-hidden="true">
        <td colSpan={columns.length} className="p-0">
          <MarkerRule />
        </td>
      </tr>
    </thead>
  );
}
