import { EntityIcon } from "@/components/library/EntityIcon";

type RelationTileProps = {
  kind: "highlight" | "insight";
  count: number;
  label: string;
  onSelect: () => void;
};

/** A hand-drawn icon over a link-colored "31 highlights" caption. */
export function RelationTile({
  kind,
  count,
  label,
  onSelect,
}: RelationTileProps) {
  const noun = count === 1 ? kind : `${kind}s`;
  return (
    <button
      type="button"
      aria-label={`${label}: ${count} ${noun}`}
      onClick={onSelect}
      className="focus-visible:outline-link flex flex-col items-center gap-1 focus-visible:outline-2"
    >
      <EntityIcon kind={kind} />
      <span className="text-link text-xs">
        {count} {noun}
      </span>
    </button>
  );
}
