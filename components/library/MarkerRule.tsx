type MarkerRuleProps = {
  /** Tailwind height class: about h-[7px] under a table header, h-1 under a menu item. */
  className?: string;
};

/**
 * The hand-drawn marker line under table headers and the active section.
 * A filled path stretched to the container width, not a CSS border.
 */
export function MarkerRule({ className = "h-[7px]" }: MarkerRuleProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 1400 9"
      preserveAspectRatio="none"
      className={`text-ink block w-full ${className}`}
    >
      <path
        fill="currentColor"
        d="M0 5.2C0 3.4 2 2.2 6 2.1C120 1.6 260 2.5 420 2.2C600 1.8 760 2.7 940 2.4C1100 2.1 1240 2.9 1380 2.6C1393 2.5 1400 3.4 1399 4.6C1398 6.2 1394 6.7 1384 6.6C1250 6.9 1110 6.2 950 6.6C780 7 620 6.3 440 6.7C270 7 130 6.4 8 6.8C2 6.8 0 6.3 0 5.2Z"
      />
    </svg>
  );
}
