"use client";

import { useEffect, useRef, useState } from "react";

import { FilterConditionRow } from "@/components/library/filter/FilterConditionRow";
import type { SelectOption } from "@/components/library/filter/MultiSelect";
import {
  defaultValue,
  EMPTY_FILTER,
  fieldsFor,
  type Condition,
  type FieldDef,
  type FilterableLens,
  type FilterState,
  type OptionsKey,
} from "@/lib/library/filter-conditions";
import type { LibraryBook } from "@/lib/library/types";

type FilterPopoverProps = {
  lens: FilterableLens;
  filter: FilterState;
  /** How many conditions currently narrow the list. */
  activeCount: number;
  books: LibraryBook[];
  onChange: (next: FilterState) => void;
};

const TYPE_OPTIONS: SelectOption[] = [
  { value: "event", label: "Event", type: "event" },
  { value: "person", label: "Person", type: "person" },
  { value: "place", label: "Place", type: "place" },
  { value: "concept", label: "Concept", type: "concept" },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: "researched", label: "Researched" },
  { value: "pending", label: "Pending" },
  { value: "discarded", label: "Discarded" },
  { value: "failed", label: "Failed" },
];

function blankCondition(fields: FieldDef<never>[]): Condition {
  const field = fields[0]!;
  const op = field.ops[0]!;
  return { field: field.id, op: op.id, value: defaultValue(op.kind) };
}

/**
 * The Filter button and its condition-builder popover for the Highlights and
 * Insights lenses. The popover is positioned against the Library's sticky mast
 * (the nearest positioned ancestor), so it spans the content width under the
 * scope bar instead of hanging off the button.
 */
export function FilterPopover({
  lens,
  filter,
  activeCount,
  books,
  onChange,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fields: FieldDef<never>[] = fieldsFor(lens);
  // Stable row keys, so removing a row doesn't hand its state to the next one.
  const [rows, setRows] = useState(() => ({
    keys: filter.conditions.map((_, i) => i),
    next: filter.conditions.length,
  }));
  if (rows.keys.length !== filter.conditions.length) {
    // The filter changed from outside (Clear all, URL restore): re-key.
    const keys = filter.conditions.map((_, i) => rows.next + i);
    setRows({ keys, next: rows.next + keys.length });
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) dialogRef.current?.querySelector<HTMLElement>("select")?.focus();
  }, [open]);

  function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    // An empty filter opens with one blank row, so there is something to fill in.
    if (filter.conditions.length === 0) {
      onChange({ ...filter, conditions: [blankCondition(fields)] });
    }
    setOpen(true);
  }

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function optionsFor(key: OptionsKey): SelectOption[] {
    if (key === "type") return TYPE_OPTIONS;
    if (key === "status") return STATUS_OPTIONS;
    return [...books]
      .sort((a, b) => a.title.localeCompare(b.title))
      .map((book) => ({
        value: book.id,
        label: book.author ? `${book.title} (${book.author})` : book.title,
      }));
  }

  function addCondition() {
    setRows({ keys: [...rows.keys, rows.next], next: rows.next + 1 });
    onChange({
      ...filter,
      conditions: [...filter.conditions, blankCondition(fields)],
    });
  }

  function removeCondition(index: number) {
    setRows({ ...rows, keys: rows.keys.filter((_, i) => i !== index) });
    onChange({
      ...filter,
      conditions: filter.conditions.filter((_, i) => i !== index),
    });
  }

  function updateCondition(index: number, next: Condition) {
    onChange({
      ...filter,
      conditions: filter.conditions.map((c, i) => (i === index ? next : c)),
    });
  }

  const title = lens === "insights" ? "Filter insights" : "Filter highlights";

  return (
    <div
      ref={wrapperRef}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
        className="bg-ink text-paper focus-visible:outline-link inline-flex h-8 cursor-pointer items-center gap-1.5 px-3 text-sm font-medium hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-3.5 shrink-0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M2 4h12M4.5 8h7M7 12h2" />
        </svg>
        {activeCount > 0 ? `Filter (${activeCount})` : "Filter"}
      </button>
      {open ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-label={title}
          className="bg-panel border-border-strong absolute top-full left-6 z-30 flex w-[720px] max-w-[calc(100%-3rem)] flex-col gap-3 border p-4 shadow-[0_4px_16px_rgba(42,38,32,0.1)]"
        >
          <p className="flex items-baseline gap-2 text-[13px]">
            <span className="font-semibold">{title}</span>
            <span className="text-ink-muted text-xs">
              Show {lens} that match
            </span>
          </p>
          <div className="flex flex-col gap-2">
            {filter.conditions.map((condition, index) => (
              <FilterConditionRow
                key={rows.keys[index] ?? index}
                index={index}
                join={filter.join}
                condition={condition}
                fields={fields}
                optionsFor={optionsFor}
                onJoinChange={(join) => onChange({ ...filter, join })}
                onChange={(next) => updateCondition(index, next)}
                onRemove={() => removeCondition(index)}
              />
            ))}
          </div>
          <div className="flex items-center justify-between pt-1 text-xs">
            <button
              type="button"
              onClick={addCondition}
              className="text-link focus-visible:outline-link cursor-pointer font-medium focus-visible:outline-2"
            >
              + Add condition
            </button>
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTER)}
              className="text-ink-secondary hover:text-ink focus-visible:outline-link cursor-pointer focus-visible:outline-2"
            >
              Clear all
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
