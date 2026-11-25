"use client";

import { useEffect, useRef, useState } from "react";

import type { NoteUrlResult } from "@/components/library/library-actions";

type NoteImagePopoverProps = {
  highlightId: string;
  page: number | null;
  getNoteImageUrl: (highlightId: string) => Promise<NoteUrlResult>;
};

type State =
  | { kind: "closed" }
  | { kind: "loading" }
  | { kind: "ready"; url: string }
  | { kind: "error" };

/**
 * An image icon that opens the handwritten-note scan in a popover. The signed
 * URL is requested only when it opens (it expires within minutes), never with
 * the page.
 */
export function NoteImagePopover({
  highlightId,
  page,
  getNoteImageUrl,
}: NoteImagePopoverProps) {
  const [state, setState] = useState<State>({ kind: "closed" });
  const open = state.kind !== "closed";
  const requestId = useRef(0);
  const wrapper = useRef<HTMLSpanElement>(null);

  // Clicking anywhere outside closes the popover (so two never overlap).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (wrapper.current?.contains(event.target as Node)) return;
      requestId.current++;
      setState({ kind: "closed" });
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  async function toggle() {
    const id = ++requestId.current;
    if (open) {
      setState({ kind: "closed" });
      return;
    }
    setState({ kind: "loading" });
    let next: State;
    try {
      const result = await getNoteImageUrl(highlightId);
      next = result.ok ? { kind: "ready", url: result.url } : { kind: "error" };
    } catch {
      next = { kind: "error" };
    }
    // Ignore a result for a popover that has since been closed or reopened.
    if (id === requestId.current) setState(next);
  }

  return (
    <span
      ref={wrapper}
      className="relative inline-block align-baseline"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          // Close only the popover, not a drawer around it.
          event.stopPropagation();
          requestId.current++;
          setState({ kind: "closed" });
        }
      }}
    >
      <button
        type="button"
        aria-label="Show handwritten note"
        aria-expanded={open}
        onClick={toggle}
        className="text-ink-muted hover:text-ink focus-visible:outline-link ml-1 focus-visible:outline-2"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="inline size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
        >
          <rect x="2" y="3" width="12" height="10" />
          <circle cx="6" cy="7" r="1.2" />
          <path d="M3 12l3.5-3 2.5 2 2-1.5L13 12" />
        </svg>
      </button>
      {open ? (
        <span
          role="dialog"
          aria-label="Handwritten note"
          className="border-border-strong bg-panel absolute top-full left-0 z-10 mt-2 block w-72 border p-3 text-sm shadow-sm"
        >
          {state.kind === "loading" ? (
            <span className="text-ink-muted">Loading…</span>
          ) : null}
          {state.kind === "error" ? (
            <span className="text-ink-secondary">
              Couldn&apos;t load the note image.
            </span>
          ) : null}
          {state.kind === "ready" ? (
            // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not optimizable
            <img src={state.url} alt="Handwritten note" className="w-full" />
          ) : null}
          <span className="text-ink-muted mt-2 block text-xs">
            Handwritten note{page !== null ? ` · page ${page}` : ""}
          </span>
        </span>
      ) : null}
    </span>
  );
}
