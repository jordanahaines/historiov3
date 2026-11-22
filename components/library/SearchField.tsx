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
  return (
    <input
      type="search"
      value={value}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(event) => onChange(event.target.value)}
      className="border-border-strong placeholder:text-ink-muted focus:border-link w-full max-w-md border-b bg-transparent px-1 py-1.5 text-sm focus:outline-none"
    />
  );
}
