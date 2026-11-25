"use client";

import { useState } from "react";

import { FilterSelect } from "@/components/library/filter/FilterSelect";

type YearInputProps = {
  label: string;
  /** Astronomical year (1 BC = 0), or null while empty. */
  value: number | null;
  onChange: (next: number | null) => void;
};

const field =
  "border-border-strong bg-paper focus:border-link h-[30px] border px-2 text-[13px] focus:outline-none";

/** A year with a CE/BC era; the value it reports is the astronomical year. */
export function YearInput({ label, value, onChange }: YearInputProps) {
  // The era follows the value when there is one; local state only remembers
  // the choice while the number is empty, so a reused row never shows a stale era.
  const [emptyEra, setEra] = useState<"CE" | "BC">("CE");
  const era = value === null ? emptyEra : value <= 0 ? "BC" : "CE";
  const shown = value === null ? "" : String(value <= 0 ? 1 - value : value);

  function emit(raw: string, nextEra: "CE" | "BC") {
    const n = Number(raw);
    if (raw.trim() === "" || !Number.isInteger(n) || n < 1) {
      // Remember the era so retyping after a clear keeps it.
      setEra(nextEra);
      onChange(null);
      return;
    }
    onChange(nextEra === "BC" ? 1 - n : n);
  }

  return (
    <span className="flex items-center gap-1">
      <input
        type="number"
        min={1}
        step={1}
        value={shown}
        aria-label={label}
        onChange={(event) => emit(event.target.value, era)}
        className={`${field} w-20`}
      />
      <FilterSelect
        aria-label={`${label} era`}
        value={era}
        onChange={(event) => {
          const next = event.target.value as "CE" | "BC";
          setEra(next);
          emit(shown, next);
        }}
        wrapperClassName="w-[72px]"
      >
        <option value="CE">CE</option>
        <option value="BC">BC</option>
      </FilterSelect>
    </span>
  );
}
