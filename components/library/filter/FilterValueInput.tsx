"use client";

import {
  MultiSelect,
  type SelectOption,
} from "@/components/library/filter/MultiSelect";
import { YearInput } from "@/components/library/filter/YearInput";
import type { FilterValue, ValueKind } from "@/lib/library/filter-conditions";

type FilterValueInputProps = {
  kind: ValueKind;
  fieldLabel: string;
  value: FilterValue;
  options: SelectOption[];
  onChange: (next: FilterValue) => void;
};

const field =
  "border-border-strong bg-paper focus:border-link h-[30px] border px-2 text-[13px] focus:outline-none";

const asList = (value: FilterValue) => (Array.isArray(value) ? value : []);

/** The value editor for a condition, chosen by the operator's value kind. */
export function FilterValueInput({
  kind,
  fieldLabel,
  value,
  options,
  onChange,
}: FilterValueInputProps) {
  const [first, second] = asList(value);

  switch (kind) {
    case "none":
      return null;
    case "text":
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          aria-label={`${fieldLabel} value`}
          placeholder="Text"
          onChange={(event) => onChange(event.target.value)}
          className={`${field} min-w-0 flex-1`}
        />
      );
    case "number":
      return (
        <input
          type="number"
          min={0}
          step={1}
          value={typeof value === "number" ? value : ""}
          aria-label={`${fieldLabel} value`}
          onChange={(event) =>
            onChange(
              event.target.value === "" ? null : Number(event.target.value),
            )
          }
          className={`${field} w-24`}
        />
      );
    case "year":
      return (
        <YearInput
          label={`${fieldLabel} year`}
          value={typeof value === "number" ? value : null}
          onChange={onChange}
        />
      );
    case "yearRange":
      return (
        <span className="flex flex-wrap items-center gap-2">
          <YearInput
            label={`${fieldLabel} from`}
            value={typeof first === "number" ? first : null}
            onChange={(next) => onChange([next, second ?? null])}
          />
          <span className="text-ink-muted text-xs">to</span>
          <YearInput
            label={`${fieldLabel} to`}
            value={typeof second === "number" ? second : null}
            onChange={(next) => onChange([first ?? null, next])}
          />
        </span>
      );
    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          aria-label={`${fieldLabel} date`}
          onChange={(event) => onChange(event.target.value)}
          className={field}
        />
      );
    case "dateRange":
      return (
        <span className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={typeof first === "string" ? first : ""}
            aria-label={`${fieldLabel} from`}
            onChange={(event) => onChange([event.target.value, second ?? ""])}
            className={field}
          />
          <span className="text-ink-muted text-xs">and</span>
          <input
            type="date"
            value={typeof second === "string" ? second : ""}
            aria-label={`${fieldLabel} to`}
            onChange={(event) => onChange([first ?? "", event.target.value])}
            className={field}
          />
        </span>
      );
    case "multi":
      return (
        <MultiSelect
          label={fieldLabel}
          options={options}
          selected={asList(value).filter(
            (v): v is string => typeof v === "string",
          )}
          onChange={onChange}
        />
      );
  }
}
