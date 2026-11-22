import { coverColor } from "@/lib/library/cover-color";

type BookCoverProps = { bookId: string; title: string; src: string | null };

/** 44×64: the catalog cover, or a muted block with the title in serif. */
export function BookCover({ bookId, title, src }: BookCoverProps) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- catalog URLs come from arbitrary hosts
      <img
        src={src}
        alt=""
        width={44}
        height={64}
        className="h-16 w-11 object-cover"
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      style={{ backgroundColor: coverColor(bookId) }}
      className="text-ink flex h-16 w-11 items-center justify-center overflow-hidden p-1 text-center font-serif text-[8px] leading-tight"
    >
      {title}
    </div>
  );
}
