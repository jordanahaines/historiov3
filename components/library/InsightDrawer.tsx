"use client";

import { useEffect, useId, useRef } from "react";

import { DrawerHighlight } from "@/components/library/DrawerHighlight";
import type { NoteUrlResult } from "@/components/library/library-actions";
import { TypeDot } from "@/components/library/TypeDot";
import { VisibilityToggle } from "@/components/library/VisibilityToggle";
import { formatPeriodParts } from "@/lib/insights/period-format";
import type {
  LibraryBook,
  LibraryHighlight,
  LibraryInsight,
} from "@/lib/library/types";

type InsightDrawerProps = {
  insight: LibraryInsight;
  /** The highlights behind the insight that the viewer's library lists. */
  highlights: LibraryHighlight[];
  /** Books by id, for each highlight's thumbnail and source. */
  books: Record<string, LibraryBook>;
  error?: string;
  onClose: () => void;
  onHide: (id: string) => void;
  onRestore: (id: string) => void;
  getNoteImageUrl: (highlightId: string) => Promise<NoteUrlResult>;
};

/**
 * Right-docked, non-modal panel that reads one insight in full (design file:
 * "Library - Insight drawer"). It takes only the insight, its highlights and
 * callbacks, so the Map page can reuse it.
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
  const panel = useRef<HTMLDivElement>(null);

  // Move focus into the drawer when it opens or switches to another insight.
  useEffect(() => {
    panel.current?.focus();
  }, [insight.id]);

  // Wheel scrolling over the drawer must never reach the table behind it. Only
  // the highlights list scrolls (and contains its own overscroll); anywhere
  // else, or when that list has nothing to scroll, the wheel is swallowed.
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    function onWheel(event: WheelEvent) {
      const target = event.target;
      const list =
        target instanceof Element
          ? target.closest("[data-drawer-scroll]")
          : null;
      if (!list || list.scrollHeight <= list.clientHeight)
        event.preventDefault();
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const hidden = insight.status === "hidden";
  const period = formatPeriodParts(insight.period);
  const when = period.end ? `${period.start} to ${period.end}` : period.start;

  return (
    <div
      ref={panel}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="border-border-strong bg-panel fixed right-0 bottom-0 z-30 flex w-full flex-col border-l shadow-[-6px_0_24px_rgba(42,38,32,0.06)] focus:outline-none sm:w-[400px]"
      style={{ top: "var(--nav-h)" }}
    >
      <div className="border-border flex items-center justify-between border-b px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="text-ink-secondary flex items-center gap-2 text-xs font-medium capitalize">
            <TypeDot type={insight.type} faded={hidden} baseline={false} />
            {insight.type}
          </span>
          {hidden ? (
            <span className="bg-wash text-ink-secondary px-1.5 py-0.5 text-xs">
              Hidden
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <VisibilityToggle
            label="Visible"
            checked={!hidden}
            onChange={(visible) =>
              visible ? onRestore(insight.id) : onHide(insight.id)
            }
          />
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-ink-secondary hover:text-ink focus-visible:outline-link focus-visible:outline-2"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-[18px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-type-event px-5 pt-3 text-xs">
          {error}
        </p>
      ) : null}
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
    </div>
  );
}
