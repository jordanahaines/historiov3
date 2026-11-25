"use client";

import { useEffect, useId, useRef, useState } from "react";

import { DrawerHighlight } from "@/components/library/DrawerHighlight";
import type { NoteUrlResult } from "@/components/library/library-actions";
import { TypeDot } from "@/components/library/TypeDot";
import { formatPeriodParts } from "@/lib/insights/period-format";
import type { LibraryHighlight, LibraryInsight } from "@/lib/library/types";

type InsightDrawerProps = {
  insight: LibraryInsight;
  /** The highlights behind the insight that the viewer's library lists. */
  highlights: LibraryHighlight[];
  /** Book titles by id. */
  bookTitles: Record<string, string>;
  error?: string;
  onClose: () => void;
  onHide: (id: string) => void;
  onRestore: (id: string) => void;
  getNoteImageUrl: (highlightId: string) => Promise<NoteUrlResult>;
};

const INITIAL_HIGHLIGHTS = 2;

/**
 * Right-docked, non-modal panel that reads one insight in full. It takes only
 * the insight, its highlights and callbacks, so the Map page can reuse it.
 */
export function InsightDrawer({
  insight,
  highlights,
  bookTitles,
  error,
  onClose,
  onHide,
  onRestore,
  getNoteImageUrl,
}: InsightDrawerProps) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const [expandedFor, setExpandedFor] = useState<string | null>(null);

  // Move focus into the drawer when it opens or switches to another insight.
  useEffect(() => {
    panel.current?.focus();
  }, [insight.id]);

  const hidden = insight.status === "hidden";
  const period = formatPeriodParts(insight.period);
  const expanded = expandedFor === insight.id;
  const shown = expanded ? highlights : highlights.slice(0, INITIAL_HIGHLIGHTS);
  const more = highlights.length - shown.length;

  return (
    <div
      ref={panel}
      role="dialog"
      aria-labelledby={titleId}
      tabIndex={-1}
      className="border-border-strong bg-panel fixed right-0 bottom-0 z-30 flex w-full flex-col border-l shadow-sm focus:outline-none sm:w-[400px]"
      style={{ top: "var(--nav-h)" }}
    >
      <div className="flex-1 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="flex items-center gap-1.5 capitalize">
              <TypeDot type={insight.type} faded={hidden} baseline={false} />
              {insight.type}
            </span>
            {hidden ? (
              <span className="bg-wash text-ink-secondary px-1.5 py-0.5 text-xs">
                Hidden
              </span>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-ink-secondary hover:text-ink focus-visible:outline-link -m-1 p-1 focus-visible:outline-2"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
            >
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>
        <h2
          id={titleId}
          className={`mt-3 font-serif text-2xl ${hidden ? "text-ink-muted" : ""}`}
        >
          {insight.title}
        </h2>
        <p className="mt-2 text-sm">
          {period.start}
          {period.end ? (
            <span className="text-ink-muted"> to {period.end}</span>
          ) : null}
        </p>
        {insight.locationName ? (
          <p className="text-ink-secondary mt-1 text-sm">
            {insight.locationName}
          </p>
        ) : null}
        {insight.aliases.length > 0 ? (
          <p className="text-ink-secondary mt-1 text-sm">
            Also: {insight.aliases.join(", ")}
          </p>
        ) : null}
        {insight.description ? (
          <p className="mt-4 font-serif text-base whitespace-pre-line">
            {insight.description}
          </p>
        ) : null}
        <div className="mt-4">
          <button
            type="button"
            onClick={() =>
              hidden ? onRestore(insight.id) : onHide(insight.id)
            }
            className="text-link focus-visible:outline-link text-sm hover:underline focus-visible:outline-2"
          >
            {hidden ? "Restore" : "Hide insight"}
          </button>
          {error ? (
            <p role="alert" className="text-type-event mt-1 text-xs">
              {error}
            </p>
          ) : null}
        </div>
        {highlights.length > 0 ? (
          <section className="mt-6">
            <h3 className="text-ink-secondary text-xs font-semibold tracking-wide uppercase">
              From your reading
            </h3>
            <ul className="mt-2">
              {shown.map((highlight) => (
                <DrawerHighlight
                  key={highlight.id}
                  highlight={highlight}
                  bookTitle={bookTitles[highlight.bookId] ?? ""}
                  getNoteImageUrl={getNoteImageUrl}
                />
              ))}
            </ul>
            {more > 0 ? (
              <button
                type="button"
                onClick={() => setExpandedFor(insight.id)}
                className="text-link focus-visible:outline-link mt-1 text-sm hover:underline focus-visible:outline-2"
              >
                {more} more {more === 1 ? "highlight" : "highlights"}
              </button>
            ) : null}
          </section>
        ) : null}
      </div>
    </div>
  );
}
