import { EntityIcon } from "@/components/library/EntityIcon";
import { VisibilityIcon } from "@/components/library/VisibilityIcon";
import { TypeDot } from "@/components/library/TypeDot";
import { formatPeriodParts } from "@/lib/insights/period-format";
import type { LibraryInsight } from "@/lib/library/types";

type InsightRowProps = {
  insight: LibraryInsight;
  error?: string;
  selected?: boolean;
  onOpen: (insightId: string) => void;
  onShowHighlights: (insightId: string) => void;
  onHide: (id: string) => void;
  onRestore: (id: string) => void;
};

export function InsightRow({
  insight,
  error,
  selected = false,
  onOpen,
  onShowHighlights,
  onHide,
  onRestore,
}: InsightRowProps) {
  const hidden = insight.status === "hidden";
  const period = formatPeriodParts(insight.period);
  const muted = hidden ? "text-ink-muted" : "";

  return (
    <tr
      data-insight-row={insight.id}
      tabIndex={0}
      aria-current={selected ? "true" : undefined}
      onClick={() => onOpen(insight.id)}
      onKeyDown={(event) => {
        // Only keys pressed on the row itself; buttons inside handle their own.
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(insight.id);
        }
      }}
      className={`group border-border focus-visible:outline-link cursor-pointer border-b align-top focus-visible:outline-2 ${
        selected ? "bg-wash/50" : ""
      } ${muted}`}
    >
      <td className="py-3 pr-4">
        <div className="flex gap-2">
          <TypeDot type={insight.type} faded={hidden} />
          <div>
            <span className="font-serif text-base">{insight.title}</span>
            {hidden ? (
              <div className="mt-1">
                <span className="bg-wash text-ink-secondary px-1.5 py-0.5 text-xs">
                  Hidden
                </span>
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="text-type-event mt-1 text-xs">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </td>
      <td className="py-3 pr-4">
        <p className="line-clamp-2 font-serif text-sm">
          {insight.description ?? ""}
        </p>
      </td>
      <td className="py-3 pr-4 text-sm whitespace-nowrap">
        {period.start}
        {period.end ? (
          <div className="text-ink-muted text-xs">to {period.end}</div>
        ) : null}
      </td>
      <td className="py-3 pr-4 text-sm">{insight.locationName ?? "–"}</td>
      <td className="py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label={`Show highlights for ${insight.title}: ${insight.highlightCount}`}
            title={`${insight.highlightCount} ${insight.highlightCount === 1 ? "highlight" : "highlights"}`}
            onClick={(event) => {
              event.stopPropagation();
              onShowHighlights(insight.id);
            }}
            className="bg-wash text-ink-secondary hover:text-ink focus-visible:outline-link inline-flex items-center gap-1 px-1.5 py-0.5 text-xs focus-visible:outline-2"
          >
            <EntityIcon kind="highlight" size="small" />
            {insight.highlightCount}
          </button>
          {hidden ? (
            <button
              type="button"
              aria-label={`Restore ${insight.title}`}
              title="Restore"
              onClick={(event) => {
                event.stopPropagation();
                onRestore(insight.id);
              }}
              className="text-link focus-visible:outline-link focus-visible:outline-2"
            >
              <VisibilityIcon visible />
            </button>
          ) : (
            <button
              type="button"
              aria-label={`Hide ${insight.title}`}
              title="Hide"
              onClick={(event) => {
                event.stopPropagation();
                onHide(insight.id);
              }}
              className="text-ink-secondary hover:text-ink focus-visible:outline-link opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2"
            >
              <VisibilityIcon visible={false} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
