import { coverColor } from "@/lib/library/cover-color";

type BookCoverProps = {
  bookId: string;
  title: string;
  src: string | null;
  /** "medium" is 36×52 (highlight drawer); "small" is a 16×22 thumbnail with no title text (insight drawer). */
  size?: "default" | "medium" | "small";
};

const BOX = {
  default: { w: 44, h: 64, cls: "h-16 w-11", text: "text-[8px]" },
  medium: { w: 36, h: 52, cls: "h-[52px] w-9", text: "text-[7px]" },
  small: { w: 16, h: 22, cls: "h-[22px] w-4", text: "" },
} as const;

/** The catalog cover, or a muted block with the title in serif (44×64, 36×52 or 16×22). */
export function BookCover({
  bookId,
  title,
  src,
  size = "default",
}: BookCoverProps) {
  const box = BOX[size];
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- catalog URLs come from arbitrary hosts
      <img
        src={src}
        alt=""
        width={box.w}
        height={box.h}
        className={`${box.cls} shrink-0 object-cover`}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      style={{ backgroundColor: coverColor(bookId) }}
      className={
        size === "small"
          ? `${box.cls} shrink-0`
          : `text-ink flex ${box.cls} shrink-0 items-center justify-center overflow-hidden p-1 text-center font-serif ${box.text} leading-tight`
      }
    >
      {size === "small" ? null : title}
    </div>
  );
}
