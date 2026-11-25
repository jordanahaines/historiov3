import Image from "next/image";

type EntityIconProps = {
  kind: "highlight" | "insight";
  /** `small` is the 14px muted variant used next to titles. */
  size?: "small" | "large";
  className?: string;
};

/** Hand-drawn icons exported from the external design file historiov3.pen, see CLAUDE.md (public/icons). */
export function EntityIcon({
  kind,
  size = "large",
  className,
}: EntityIconProps) {
  const px = size === "small" ? 14 : 32;
  const file = size === "small" ? `${kind}-small` : kind;
  return (
    <Image
      src={`/icons/${file}.svg`}
      alt=""
      width={px}
      height={px}
      unoptimized
      className={className}
    />
  );
}
