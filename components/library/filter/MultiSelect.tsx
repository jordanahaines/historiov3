"use client";

import { useState } from "react";

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

const INLINE_LIMIT = 6;

/** Toggle chips for a short list; a searchable checkbox list for a long one (books). */
export function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: MultiSelectProps) {
  const [search, setSearch] = useState("");

  function toggle(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  if (options.length <= INLINE_LIMIT) {
    return (
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(option.value)}
              className={`focus-visible:outline-link flex cursor-pointer items-center gap-1.5 px-2 py-1 text-xs focus-visible:outline-2 ${
                on ? "bg-wash text-ink" : "text-ink-muted"
              }`}
            >
              {option.type ? (
                <span
                  aria-hidden="true"
                  className={`inline-block size-2 rounded-full ${
                    on ? DOT[option.type] : "border border-current"
                  }`}
                />
              ) : null}
              {option.label}
            </button>
          );
        })}
      </div>
    );
  }

  const needle = search.trim().toLowerCase();
  const visible = options.filter((o) => o.label.toLowerCase().includes(needle));
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-1">
      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={`Search ${label.toLowerCase()}`}
        aria-label={`Search ${label.toLowerCase()}`}
        className="border-border-strong bg-paper focus:border-link h-7 border px-2 text-xs focus:outline-none"
      />
      <ul className="border-border max-h-32 overflow-y-auto border">
        {visible.map((option) => (
          <li key={option.value}>
            <label className="hover:bg-wash flex cursor-pointer items-center gap-2 px-2 py-1 text-xs">
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggle(option.value)}
                className="cursor-pointer"
              />
              {option.label}
            </label>
          </li>
        ))}
        {visible.length === 0 ? (
          <li className="text-ink-muted px-2 py-1 text-xs">No matches</li>
        ) : null}
      </ul>
    </div>
  );
}
