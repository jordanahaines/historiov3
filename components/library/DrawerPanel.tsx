"use client";

import { useEffect, useRef, type ReactNode } from "react";

type DrawerPanelProps = {
  /** Changes when the drawer opens or switches to another item; focus moves into the panel. */
  focusKey: string;
  /** `id` of the title element inside, or a plain label when there is no title. */
  labelledBy?: string;
  label?: string;
  /** Left of the header: the type tag. */
  tag: ReactNode;
  /** Right of the header, before the close icon. */
  headerActions?: ReactNode;
  error?: string;
  onClose: () => void;
  children: ReactNode;
};

/**
 * The shell shared by the Insight and Highlight drawers: right-docked below the
 * sticky nav, non-modal, header bar with the type tag and close icon. Scrolling
 * over it never reaches the table behind: inside an element marked
 * `data-drawer-scroll` (which must also use `overscroll-contain`) the wheel
 * scrolls that element, anywhere else it is swallowed.
 */
export function DrawerPanel({
  focusKey,
  labelledBy,
  label,
  tag,
  headerActions,
  error,
  onClose,
  children,
}: DrawerPanelProps) {
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panel.current?.focus();
  }, [focusKey]);

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

  return (
    <div
      ref={panel}
      role="dialog"
      aria-labelledby={labelledBy}
      aria-label={label}
      tabIndex={-1}
      className="border-border-strong bg-panel fixed right-0 bottom-0 z-30 flex w-full flex-col border-l shadow-[-6px_0_24px_rgba(42,38,32,0.06)] focus:outline-none sm:w-[400px]"
      style={{ top: "var(--nav-h)" }}
    >
      <div className="border-border flex items-center justify-between border-b px-5 py-3.5">
        <div className="flex items-center gap-2">{tag}</div>
        <div className="flex items-center gap-4">
          {headerActions}
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
      {children}
    </div>
  );
}
