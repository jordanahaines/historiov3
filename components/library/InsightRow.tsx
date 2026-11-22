import { EntityIcon } from "@/components/library/EntityIcon";
import { TypeDot } from "@/components/library/TypeDot";
import { formatPeriod } from "@/lib/insights/period-format";
import type { LibraryInsight } from "@/lib/library/types";

type InsightRowProps = {
  insight: LibraryInsight;
  error?: string;
  onHide: (id: string) => void;
  onRestore: (id: string) => void;
};

export function InsightRow({
  insight,
  error,
  onHide,
  onRestore,
}: InsightRowProps) {
  const hidden = insight.status === "hidden";
  const muted = hidden ? "text-ink-muted" : "";

  return (
    <tr className={`group border-border border-b align-top ${muted}`}>
      <td className="py-3 pr-4">
        <div className="flex gap-2">
          <TypeDot type={insight.type} faded={hidden} />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-serif text-base">{insight.title}</span>
              <span className="text-ink-muted inline-flex items-center gap-1 text-xs">
                <EntityIcon kind="highlight" size="small" />
                {insight.highlightCount}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs">
              {hidden ? (
                <>
                  <span className="bg-wash text-ink-secondary px-1.5 py-0.5">
                    Hidden
                  </span>
                  <button
                    type="button"
                    aria-label={`Restore ${insight.title}`}
                    onClick={() => onRestore(insight.id)}
                    className="text-link focus-visible:outline-link hover:underline focus-visible:outline-2"
                  >
                    ↻ Restore
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  aria-label={`Hide ${insight.title}`}
                  onClick={() => onHide(insight.id)}
                  className="text-ink-secondary focus-visible:outline-link opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:underline focus-visible:opacity-100 focus-visible:outline-2"
                >
                  Hide
                </button>
              )}
            </div>
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
        {formatPeriod(insight.period)}
      </td>
      <td className="py-3 text-sm">{insight.locationName ?? "–"}</td>
    </tr>
  );
}
