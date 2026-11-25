import { coverColor } from "@/lib/library/cover-color";

type BookCoverProps = {
  bookId: string;
  title: string;
  src: string | null;
  /** "small" is a 16×22 thumbnail (no title text) for the insight drawer. */
  size?: "default" | "small";
};

/** 44×64 (or 16×22 small): the catalog cover, or a muted block with the title in serif. */
export function BookCover({
  bookId,
  title,
  src,
  size = "default",
}: BookCoverProps) {
  const small = size === "small";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- catalog URLs come from arbitrary hosts
      <img
        src={src}
        alt=""
        width={small ? 16 : 44}
        height={small ? 22 : 64}
        className={`${small ? "h-[22px] w-4" : "h-16 w-11"} shrink-0 object-cover`}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      style={{ backgroundColor: coverColor(bookId) }}
      className={
        small
          ? "h-[22px] w-4 shrink-0"
          : "text-ink flex h-16 w-11 items-center justify-center overflow-hidden p-1 text-center font-serif text-[8px] leading-tight"
      }
    >
      {small ? null : title}
    </div>
  );
}
