"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { InsightType } from "@/lib/library/types";

export type SelectOption = {
  value: string;
  label: string;
  /** Insight type: shows its color dot, matching the map and the table. */
  type?: InsightType;
};

const DOT: Record<InsightType, string> = {
  event: "bg-type-event",
  person: "bg-type-person",
  place: "bg-type-place",
  concept: "bg-type-concept",
};

type MultiSelectProps = {
  label: string;
  options: SelectOption[];
  selected: string[];
  onChange: (next: string[]) => void;
};

function TypeDot({ type }: { type?: InsightType }) {
  if (!type) return null;
  return (
    <span
      aria-hidden="true"
      className={`inline-block size-2 shrink-0 rounded-full ${DOT[type]}`}
    />
  );
}

/**
 * An autocomplete multi-select: the chosen values sit in the box as removable
 * tags, typing narrows the list below it, and the list stays open so many
 * values (hundreds of books) can be ticked without reopening it.
 */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: MultiSelectProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const needle = search.trim().toLowerCase();
  const visible = options.filter((o) => o.label.toLowerCase().includes(needle));
  const chosen = options.filter((o) => selected.includes(o.value));
  const unselectedVisible = visible.filter((o) => !selected.includes(o.value));
  const activeIndex = Math.min(active, Math.max(visible.length - 1, 0));
  const activeOption = visible[activeIndex];

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || !activeOption) return;
    listRef.current
      ?.querySelector<HTMLElement>(
        `[data-value="${CSS.escape(activeOption.value)}"]`,
      )
      ?.scrollIntoView?.({ block: "nearest" });
  }, [open, activeOption]);

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const count = visible.length;
      if (count > 0) setActive((activeIndex + step + count) % count);
    } else if (event.key === "Enter") {
      // Never submit a surrounding form; Enter ticks the highlighted option.
      event.preventDefault();
      if (open && activeOption) toggle(activeOption.value);
      else setOpen(true);
    } else if (event.key === "Escape" && open) {
      // Closes the list first; a second Escape reaches the popover.
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === "Backspace" && search === "" && selected.length) {
      onChange(selected.slice(0, -1));
    }
  }

  return (
    <div ref={wrapperRef} className="relative min-w-0 flex-1">
      <div
        onClick={() => {
          inputRef.current?.focus();
          setOpen(true);
        }}
        className="border-border-strong bg-paper focus-within:border-link flex min-h-[30px] w-full cursor-text flex-wrap items-center gap-1.5 border px-2 py-[3px]"
      >
        {chosen.map((option) => (
          <span
            key={option.value}
            className="bg-wash text-ink flex items-center gap-1.5 py-[3px] pr-1 pl-2 text-xs"
          >
            <TypeDot type={option.type} />
            {option.label}
            <button
              type="button"
              aria-label={`Remove ${option.label}`}
              onClick={(event) => {
                event.stopPropagation();
                toggle(option.value);
              }}
              className="text-ink-muted hover:text-ink focus-visible:outline-link flex size-4 cursor-pointer items-center justify-center focus-visible:outline-2"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={`${label} search`}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && activeOption ? `${listId}-${activeOption.value}` : undefined
          }
          value={search}
          placeholder={chosen.length ? "" : `Search ${label.toLowerCase()}`}
          onChange={(event) => {
            setSearch(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="placeholder:text-ink-muted h-5 min-w-[80px] flex-1 bg-transparent text-[13px] focus:outline-none"
        />
      </div>
      {open ? (
        <div className="bg-panel border-border-strong absolute top-full right-0 left-0 z-40 mt-px flex flex-col border shadow-[0_4px_16px_rgba(42,38,32,0.1)]">
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="max-h-60 overflow-y-auto"
          >
            {visible.map((option, index) => {
              const on = selected.includes(option.value);
              return (
                <li
                  key={option.value}
                  id={`${listId}-${option.value}`}
                  data-value={option.value}
                  role="option"
                  aria-selected={on}
                  // Keep focus in the input so the list stays open while ticking.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => toggle(option.value)}
                  onMouseMove={() => setActive(index)}
                  className={`flex cursor-pointer items-center gap-2 px-2 py-1.5 text-[13px] ${
                    index === activeIndex ? "bg-wash" : ""
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-3.5 shrink-0 items-center justify-center border text-[10px] leading-none ${
                      on
                        ? "border-ink bg-ink text-paper"
                        : "border-border-strong"
                    }`}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <TypeDot type={option.type} />
                  <span className="min-w-0 truncate">{option.label}</span>
                </li>
              );
            })}
            {visible.length === 0 ? (
              <li className="text-ink-muted px-2 py-1.5 text-xs">No matches</li>
            ) : null}
          </ul>
          {options.length > 6 &&
          (unselectedVisible.length > 1 || selected.length > 0) ? (
            <div className="border-border flex items-center justify-between border-t px-2 py-1.5 text-xs">
              {unselectedVisible.length > 1 ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() =>
                    onChange([
                      ...selected,
                      ...unselectedVisible.map((o) => o.value),
                    ])
                  }
                  className="text-link focus-visible:outline-link cursor-pointer font-medium focus-visible:outline-2"
                >
                  {needle
                    ? `Select all ${unselectedVisible.length} matches`
                    : `Select all ${unselectedVisible.length}`}
                </button>
              ) : (
                <span />
              )}
              {selected.length > 0 ? (
                <button
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onChange([])}
                  className="text-ink-secondary hover:text-ink focus-visible:outline-link cursor-pointer focus-visible:outline-2"
                >
                  Clear selection
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
