"use client";

import { useId } from "react";

import { DrawerHighlight } from "@/components/library/DrawerHighlight";
import { DrawerPanel } from "@/components/library/DrawerPanel";
import type { NoteUrlResult } from "@/components/library/library-actions";
import { TypeDot } from "@/components/library/TypeDot";
import { VisibilityToggle } from "@/components/library/VisibilityToggle";
import { periodLabel } from "@/lib/library/period-label";
import type {
  LibraryBook,
  LibraryHighlight,
  LibraryInsight,
} from "@/lib/library/types";

type InsightDrawerProps = {
  insight: LibraryInsight;
  /** The highlights behind the insight that the viewer's library lists. */
  highlights: LibraryHighlight[];
  /** Books by id, for each highlight's thumbnail. */
  books: Record<string, LibraryBook>;
  error?: string;
  onClose: () => void;
  onHide: (id: string) => void;
  onRestore: (id: string) => void;
  getNoteImageUrl: (highlightId: string) => Promise<NoteUrlResult>;
};

/**
 * Reads one insight in full (design file: "Library - Insight drawer"). It
 * takes only the insight, its highlights and callbacks, so the Map page can
 * reuse it.
 */
export function InsightDrawer({
  insight,
  highlights,
  books,
  error,
  onClose,
  onHide,
  onRestore,
  getNoteImageUrl,
}: InsightDrawerProps) {
  const titleId = useId();
  const hidden = insight.status === "hidden";
  const when = periodLabel(insight.period);

  return (
    <DrawerPanel
      focusKey={insight.id}
      labelledBy={titleId}
      error={error}
      onClose={onClose}
      tag={
        <>
          <span className="text-ink-secondary flex items-center gap-2 text-xs font-medium capitalize">
            <TypeDot type={insight.type} faded={hidden} baseline={false} />
            {insight.type}
          </span>
          {hidden ? (
            <span className="bg-wash text-ink-secondary px-1.5 py-0.5 text-xs">
              Hidden
            </span>
          ) : null}
        </>
      }
      headerActions={
        <VisibilityToggle
          label="Visible"
          checked={!hidden}
          onChange={(visible) =>
            visible ? onRestore(insight.id) : onHide(insight.id)
          }
        />
      }
    >
      <div className="flex min-h-0 flex-1 flex-col gap-5 px-5 pt-5 pb-6">
        <div className="flex shrink-0 flex-col gap-1.5">
          <h2
            id={titleId}
            className={`font-serif text-[28px] leading-[1.15] font-medium ${hidden ? "text-ink-muted" : ""}`}
          >
            {insight.title}
          </h2>
          <p className="text-ink-secondary text-[13px]">
            {when}
            {insight.locationName ? `  ·  ${insight.locationName}` : ""}
          </p>
          {insight.aliases.length > 0 ? (
            <p className="text-ink-muted text-xs">
              Also: {insight.aliases.join(", ")}
            </p>
          ) : null}
        </div>
        {insight.description ? (
          <p className="shrink-0 font-serif text-[15px] leading-normal whitespace-pre-line">
            {insight.description}
          </p>
        ) : null}
        {highlights.length > 0 ? (
          <section className="flex min-h-[120px] min-w-0 flex-1 flex-col gap-2.5">
            <h3 className="text-ink-secondary shrink-0 text-xs font-medium">
              From your reading
            </h3>
            <ul
              data-drawer-scroll
              className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto overscroll-contain pr-2"
            >
              {highlights.map((highlight) => (
                <DrawerHighlight
                  key={highlight.id}
                  highlight={highlight}
                  book={books[highlight.bookId]}
                  getNoteImageUrl={getNoteImageUrl}
                />
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </DrawerPanel>
  );
}
