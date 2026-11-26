type SearchFieldProps = {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
};

export function SearchField({
  value,
  placeholder,
  onChange,
}: SearchFieldProps) {
  const widthClass = value ? "w-80" : "w-44";

  return (
    <div
      className={`border-border-strong focus-within:border-link flex h-9 max-w-full shrink-0 items-center gap-2 border-b px-1 transition-[width] duration-200 ease-out focus-within:w-80 motion-reduce:transition-none ${widthClass}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="text-ink-muted size-4 shrink-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      >
        <circle cx="7" cy="7" r="4.5" />
        <path d="M10.5 10.5L14 14" />
      </svg>
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="placeholder:text-ink-muted w-full bg-transparent py-1.5 text-sm focus:outline-none"
      />
    </div>
  );
}
