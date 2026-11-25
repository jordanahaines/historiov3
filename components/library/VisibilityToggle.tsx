type VisibilityToggleProps = {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
};

/** The drawer's pill switch: ink track with a paper knob when on (see the design file). */
export function VisibilityToggle({
  label,
  checked,
  onChange,
}: VisibilityToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="focus-visible:outline-link flex items-center gap-2 bg-transparent focus-visible:outline-2"
    >
      <span className="text-ink-secondary text-[13px] font-medium">
        {label}
      </span>
      <span
        aria-hidden="true"
        className={`relative inline-block h-5 w-[34px] rounded-full transition-colors ${
          checked ? "bg-ink" : "bg-border-strong"
        }`}
      >
        <span
          className={`bg-paper absolute top-0.5 size-4 rounded-full transition-all ${
            checked ? "left-4" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}
