import { MarkerRule } from "@/components/library/MarkerRule";
import type { Lens } from "@/lib/library/types";

type SectionMenuProps = {
  lens: Lens;
  counts: Record<Lens, number>;
  onSelect: (lens: Lens) => void;
};

const SECTIONS: { lens: Lens; label: string }[] = [
  { lens: "books", label: "Books" },
  { lens: "highlights", label: "Highlights" },
  { lens: "insights", label: "Insights" },
];

/** Text menu, not toggle buttons: the active section is bold with a marker underline. */
export function SectionMenu({ lens, counts, onSelect }: SectionMenuProps) {
  return (
    <nav aria-label="Library sections" className="flex gap-6">
      {SECTIONS.map((section) => {
        const active = section.lens === lens;
        return (
          <button
            key={section.lens}
            type="button"
            aria-current={active ? "true" : undefined}
            onClick={() => onSelect(section.lens)}
            className="group focus-visible:outline-link relative pb-2 text-left focus-visible:outline-2"
          >
            <span
              className={
                active
                  ? "text-ink font-semibold"
                  : "text-ink-secondary group-hover:text-ink"
              }
            >
              {section.label}
            </span>{" "}
            <span className="text-ink-muted text-sm">
              {counts[section.lens]}
            </span>
            {active ? (
              <span className="absolute inset-x-0 bottom-0">
                <MarkerRule className="h-1" />
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
