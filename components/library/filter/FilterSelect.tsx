import type { ComponentProps } from "react";

type FilterSelectProps = ComponentProps<"select"> & {
  /** Width and flex classes for the wrapper; the select fills it. */
  wrapperClassName?: string;
};

/**
 * A native select drawn like the design: paper fill, hairline border, 13px
 * text, and a 12px chevron at the right edge (the browser's own arrow is hidden).
 */
export function FilterSelect({
  wrapperClassName = "",
  className = "",
  children,
  ...props
}: FilterSelectProps) {
  return (
    <span className={`relative inline-flex shrink-0 ${wrapperClassName}`}>
      <select
        {...props}
        className={`border-border-strong bg-paper focus:border-link h-[30px] w-full cursor-pointer appearance-none border pr-7 pl-2 text-[13px] focus:outline-none ${className}`}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 12 12"
        className="text-ink-secondary pointer-events-none absolute top-1/2 right-2 size-3 -translate-y-1/2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M2.5 4.5L6 8l3.5-3.5" />
      </svg>
    </span>
  );
}
