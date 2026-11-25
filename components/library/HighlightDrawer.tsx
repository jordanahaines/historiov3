"use client";

import { useEffect, useRef, useState } from "react";

import { BookCover } from "@/components/library/BookCover";
import { DrawerPanel } from "@/components/library/DrawerPanel";
import { EntityIcon } from "@/components/library/EntityIcon";
import { NoteImagePopover } from "@/components/library/NoteImagePopover";
import type { NoteUrlResult } from "@/components/library/library-actions";
import { TypeDot } from "@/components/library/TypeDot";
import { formatDate } from "@/lib/library/format-date";
import { periodLabel } from "@/lib/library/period-label";
import { highlightStatusLabel } from "@/lib/library/status-label";
import type {
  LibraryBook,
  LibraryHighlight,
  LibraryInsight,
} from "@/lib/library/types";

type HighlightDrawerProps = {
  highlight: LibraryHighlight;
  book: LibraryBook | undefined;
  /** The published insights this highlight became, in display order. */
  insights: LibraryInsight[];
  onClose: () => void;
  onOpenInsight: (insightId: string) => void;
  onOpenBook: (bookId: string) => void;
  getNoteImageUrl: (highlightId: string) => Promise<NoteUrlResult>;
};

/** Reads one highlight in full (design file: "Library - Highlight drawer"). */
export function HighlightDrawer({
  highlight,
  book,
  insights,
  onClose,
  onOpenInsight,
  onOpenBook,
  getNoteImageUrl,
}: HighlightDrawerProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const status = highlightStatusLabel(highlight.status);
  const source = [
    book?.author,
    highlight.page !== null ? `p. ${highlight.page}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const hasNote = Boolean(highlight.noteText) || highlight.hasNoteImage;

  async function copyQuote() {
    try {
      await navigator.clipboard.writeText(highlight.text);
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), 1500);
  }

  return (
    <DrawerPanel
      focusKey={highlight.id}
      label="Highlight"
      onClose={onClose}
      tag={
        <span className="text-ink-secondary flex items-center gap-2 text-xs font-medium">
          <EntityIcon kind="highlight" size="small" />
          Highlight
        </span>
      }
    >
      <div
        data-drawer-scroll
        className="flex min-h-0 flex-1 flex-col gap-[22px] overflow-y-auto overscroll-contain px-5 pt-5 pb-6"
      >
        <div className="flex flex-col gap-2.5">
          <p className="font-serif text-[22px] leading-[1.3] font-medium">
            <span className="marker-highlight">{highlight.text}</span>
          </p>
          <p className="text-ink-muted text-xs">
            Captured {formatDate(highlight.capturedAt)}
            {"  ·  "}
            {status.label}
          </p>
        </div>
        {hasNote ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-ink-secondary text-xs font-medium">
              Your note
            </h3>
            {highlight.noteText ? (
              <p className="font-hand text-note text-xl leading-tight">
                {highlight.noteText}
              </p>
            ) : null}
            {highlight.hasNoteImage ? (
              <NoteImagePopover
                highlightId={highlight.id}
                page={highlight.page}
                label={`Handwritten note${highlight.page !== null ? ` · page ${highlight.page}` : ""}`}
                getNoteImageUrl={getNoteImageUrl}
              />
            ) : null}
          </div>
        ) : null}
        {book ? (
          <div className="border-border flex flex-col gap-2.5 border-t pt-4">
            <h3 className="text-ink-secondary text-xs font-medium">
              From the book
            </h3>
            <div className="flex items-center gap-3">
              <BookCover
                size="medium"
                bookId={book.id}
                title={book.title}
                src={book.coverImageUrl}
              />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-base leading-tight font-medium">
                  {book.title}
                </p>
                {source ? (
                  <p className="text-ink-muted mt-0.5 text-xs">{source}</p>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
        <div className="flex flex-col gap-2.5">
          <h3 className="text-ink-secondary text-xs font-medium">
            {insights.length === 0
              ? "No insights yet"
              : `Became ${insights.length} ${insights.length === 1 ? "insight" : "insights"}`}
          </h3>
          {insights.length > 0 ? (
            <ul>
              {insights.map((insight) => (
                <li key={insight.id}>
                  <button
                    type="button"
                    onClick={() => onOpenInsight(insight.id)}
                    className="border-border focus-visible:outline-link flex w-full items-center gap-2.5 border-b py-2.5 text-left focus-visible:outline-2"
                  >
                    <TypeDot type={insight.type} baseline={false} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-serif text-base leading-tight font-medium">
                        {insight.title}
                      </span>
                      <span className="text-ink-muted mt-0.5 block text-xs">
                        {periodLabel(insight.period)}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-link">
                      →
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex items-center justify-between gap-2">
          {book ? (
            <button
              type="button"
              onClick={() => onOpenBook(book.id)}
              className="bg-ink text-paper focus-visible:outline-link px-3.5 py-2 text-[13px] font-medium focus-visible:outline-2"
            >
              Open book
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => void copyQuote()}
            className="text-ink-secondary hover:text-ink focus-visible:outline-link flex items-center gap-1.5 text-[13px] font-medium focus-visible:outline-2"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="8" y="8" width="14" height="14" rx="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
            {copied ? "Copied" : "Copy quote"}
          </button>
        </div>
      </div>
    </DrawerPanel>
  );
}
