export type ScopeChip = { key: string; label: string };

type ScopeBarProps = {
  chips: ScopeChip[];
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
      {chips.length > 0 ? (
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
          <label className="text-ink-secondary flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={hidden.checked}
              onChange={(event) => hidden.onChange(event.target.checked)}
              className="accent-ink size-3.5"
            />
            Show hidden ({hidden.count})
          </label>
        ) : null}
        <span className="text-ink-muted">{resultText}</span>
      </span>
    </div>
  );
}
