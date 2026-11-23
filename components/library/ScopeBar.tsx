import type { ReactNode } from "react";

export type ScopeChip = { key: string; label: string };

type ScopeBarProps = {
  chips: ScopeChip[];
  /** The Filter button and popover (Highlights and Insights only). */
  filterControl?: ReactNode;
  /** Show Clear even with no chips, e.g. when a filter is active. */
  canClear?: boolean;
  onRemoveChip: (key: string) => void;
  onClear: () => void;
  /** Only the Insights section has hidden items to show. */
  hidden?: {
    count: number;
    checked: boolean;
    onChange: (next: boolean) => void;
  };
  resultText: string;
};

/** Active scope chips, a Clear link, the Show hidden checkbox and the result count. */
export function ScopeBar({
  chips,
  filterControl,
  canClear = false,
  onRemoveChip,
  onClear,
  hidden,
  resultText,
}: ScopeBarProps) {
  return (
    <div className="flex min-h-9 flex-wrap items-center gap-3 text-sm">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="bg-wash inline-flex items-center gap-1.5 px-2.5 py-1"
        >
          <span>In {chip.label}</span>
          <button
            type="button"
            aria-label={`Remove scope ${chip.label}`}
            onClick={() => onRemoveChip(chip.key)}
            className="text-ink-secondary hover:text-ink focus-visible:outline-link focus-visible:outline-2"
          >
            ×
          </button>
        </span>
      ))}
      {filterControl}
      {chips.length > 0 || canClear ? (
        <button
          type="button"
          onClick={onClear}
          className="text-link focus-visible:outline-link underline-offset-2 hover:underline focus-visible:outline-2"
        >
          Clear
        </button>
      ) : null}
      <span className="ml-auto flex items-center gap-4">
        {hidden ? (
          <button
            type="button"
            role="switch"
            aria-checked={hidden.checked}
            onClick={() => hidden.onChange(!hidden.checked)}
            className="text-ink-secondary focus-visible:outline-link flex items-center gap-2 bg-transparent focus-visible:outline-2"
          >
            <span
              aria-hidden="true"
              className="border-ink relative inline-block h-4 w-7 border bg-transparent"
            >
              <span
                className={`bg-ink absolute top-0.5 size-2.5 transition-all ${hidden.checked ? "left-4" : "left-0.5 opacity-40"}`}
              />
            </span>
            Show hidden ({hidden.count})
          </button>
        ) : null}
        <span className="text-ink-muted">{resultText}</span>
      </span>
    </div>
  );
}
