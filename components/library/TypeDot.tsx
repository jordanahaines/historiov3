import type { InsightType } from "@/lib/library/types";

const COLORS: Record<InsightType, string> = {
  event: "bg-type-event",
  person: "bg-type-person",
  place: "bg-type-place",
  concept: "bg-type-concept",
};

type TypeDotProps = { type: InsightType; faded?: boolean };

export function TypeDot({ type, faded = false }: TypeDotProps) {
  return (
    <span
      role="img"
      aria-label={type}
      className={`mt-[0.55em] inline-block size-2 shrink-0 rounded-full ${COLORS[type]} ${
        faded ? "opacity-40" : ""
      }`}
    />
  );
}
