import { z } from "zod";

import { periodValues } from "@/lib/insights/period";
import type {
  Lens,
  LibraryHighlight,
  LibraryInsight,
} from "@/lib/library/types";

export type Join = "and" | "or";

/** What a condition's value input holds; ranges are `[from, to]`, multi-selects are string ids. */
export type FilterValue = string | number | null | (string | number | null)[];

export type Condition = { field: string; op: string; value: FilterValue };

export type FilterState = { join: Join; conditions: Condition[] };

export const EMPTY_FILTER: FilterState = { join: "and", conditions: [] };

export type ValueKind =
  | "none"
  | "text"
  | "number"
  | "year"
  | "yearRange"
  | "date"
  | "dateRange"
  | "multi";

/** Where a multi-select field gets its choices from. */
export type OptionsKey = "type" | "status" | "book";

export type OperatorDef<T> = {
  id: string;
  label: string;
  kind: ValueKind;
  /** Called only with a complete, well-typed value. */
  test: (item: T, value: FilterValue) => boolean;
};

export type FieldDef<T> = {
  id: string;
  label: string;
  options?: OptionsKey;
  ops: OperatorDef<T>[];
};

export type FilterableLens = Exclude<Lens, "books">;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value: FilterValue) => (typeof value === "string" ? value : "");
const num = (value: FilterValue) => (typeof value === "number" ? value : NaN);
const list = (value: FilterValue) => (Array.isArray(value) ? value : []);
const yearPair = (value: FilterValue): [number, number] => {
  const [a, b] = list(value) as number[];
  return a! <= b! ? [a!, b!] : [b!, a!];
};
const datePair = (value: FilterValue): [string, string] => {
  const [a, b] = list(value) as string[];
  return a! <= b! ? [a!, b!] : [b!, a!];
};
const contains = (haystack: string, needle: string) =>
  haystack.toLowerCase().includes(needle.trim().toLowerCase());

/** True when the value is fully filled in and the right shape for the kind. */
export function isValueComplete(kind: ValueKind, value: FilterValue): boolean {
  switch (kind) {
    case "none":
      return true;
    case "text":
      return typeof value === "string" && value.trim() !== "";
    case "number":
      return Number.isInteger(value) && (value as number) >= 0;
    case "year":
      return Number.isInteger(value);
    case "yearRange":
      return (
        Array.isArray(value) &&
        value.length === 2 &&
        value.every((v) => Number.isInteger(v))
      );
    case "date":
      return typeof value === "string" && DATE.test(value);
    case "dateRange":
      return (
        Array.isArray(value) &&
        value.length === 2 &&
        value.every((v) => typeof v === "string" && DATE.test(v))
      );
    case "multi":
      return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((v) => typeof v === "string")
      );
  }
}

export function defaultValue(kind: ValueKind): FilterValue {
  switch (kind) {
    case "text":
    case "date":
      return "";
    case "yearRange":
      return [null, null];
    case "dateRange":
      return ["", ""];
    case "multi":
      return [];
    default:
      return null;
  }
}

/** Local calendar day (YYYY-MM-DD) of an ISO timestamp. */
export function localDay(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const yesNo = <T>(has: (item: T) => boolean): OperatorDef<T>[] => [
  { id: "yes", label: "is yes", kind: "none", test: (item) => has(item) },
  { id: "no", label: "is no", kind: "none", test: (item) => !has(item) },
];

const textOps = <T>(get: (item: T) => string): OperatorDef<T>[] => [
  {
    id: "contains",
    label: "contains",
    kind: "text",
    test: (item, value) => contains(get(item), text(value)),
  },
  {
    id: "empty",
    label: "is empty",
    kind: "none",
    test: (item) => get(item).trim() === "",
  },
  {
    id: "notEmpty",
    label: "is not empty",
    kind: "none",
    test: (item) => get(item).trim() !== "",
  },
];

/** The four labels the Library shows; "contextualized" displays as Pending. */
export function highlightStatusGroup(status: LibraryHighlight["status"]) {
  return status === "contextualized" ? "pending" : status;
}

export const INSIGHT_FIELDS: FieldDef<LibraryInsight>[] = [
  {
    id: "type",
    label: "Type",
    options: "type",
    ops: [
      {
        id: "in",
        label: "is any of",
        kind: "multi",
        test: (i, v) => list(v).includes(i.type),
      },
      {
        id: "notIn",
        label: "is none of",
        kind: "multi",
        test: (i, v) => !list(v).includes(i.type),
      },
    ],
  },
  {
    id: "period",
    label: "Period",
    ops: [
      {
        id: "overlaps",
        label: "overlaps",
        kind: "yearRange",
        test: (i, v) => {
          const [from, to] = yearPair(v);
          const { start, end } = periodValues(i.period);
          return start < to + 1 && end > from;
        },
      },
      {
        id: "before",
        label: "is before",
        kind: "year",
        test: (i, v) => periodValues(i.period).end <= num(v),
      },
      {
        id: "after",
        label: "is after",
        kind: "year",
        test: (i, v) => periodValues(i.period).start >= num(v),
      },
    ],
  },
  {
    id: "area",
    label: "Area",
    ops: textOps((i) => i.locationName ?? ""),
  },
  {
    id: "book",
    label: "Book",
    options: "book",
    ops: [
      {
        id: "in",
        label: "is any of",
        kind: "multi",
        test: (i, v) => i.bookIds.some((id) => list(v).includes(id)),
      },
    ],
  },
  {
    id: "highlights",
    label: "Highlights",
    ops: [
      {
        id: "gte",
        label: "is at least",
        kind: "number",
        test: (i, v) => i.highlightCount >= num(v),
      },
      {
        id: "lte",
        label: "is at most",
        kind: "number",
        test: (i, v) => i.highlightCount <= num(v),
      },
      {
        id: "eq",
        label: "is exactly",
        kind: "number",
        test: (i, v) => i.highlightCount === num(v),
      },
    ],
  },
];

export const HIGHLIGHT_FIELDS: FieldDef<LibraryHighlight>[] = [
  {
    id: "book",
    label: "Book",
    options: "book",
    ops: [
      {
        id: "in",
        label: "is any of",
        kind: "multi",
        test: (h, v) => list(v).includes(h.bookId),
      },
    ],
  },
  {
    id: "status",
    label: "Status",
    options: "status",
    ops: [
      {
        id: "in",
        label: "is any of",
        kind: "multi",
        test: (h, v) => list(v).includes(highlightStatusGroup(h.status)),
      },
    ],
  },
  {
    id: "captured",
    label: "Captured",
    ops: [
      {
        id: "before",
        label: "is before",
        kind: "date",
        test: (h, v) => localDay(h.capturedAt) < text(v),
      },
      {
        id: "after",
        label: "is after",
        kind: "date",
        test: (h, v) => localDay(h.capturedAt) > text(v),
      },
      {
        id: "between",
        label: "is between",
        kind: "dateRange",
        test: (h, v) => {
          const [from, to] = datePair(v);
          const day = localDay(h.capturedAt);
          return day >= from && day <= to;
        },
      },
    ],
  },
  {
    id: "note",
    label: "Has note",
    ops: yesNo((h) => (h.noteText ?? "").trim() !== ""),
  },
  {
    id: "handwritten",
    label: "Has handwritten note",
    ops: yesNo((h) => h.hasNoteImage),
  },
  {
    id: "insights",
    label: "Linked insights",
    ops: textOps((h) => h.insights.map((i) => i.title).join("\n")),
  },
];

export function fieldsFor(lens: "insights"): FieldDef<LibraryInsight>[];
export function fieldsFor(lens: "highlights"): FieldDef<LibraryHighlight>[];
export function fieldsFor(
  lens: FilterableLens,
): FieldDef<LibraryInsight>[] | FieldDef<LibraryHighlight>[];
export function fieldsFor(lens: FilterableLens) {
  return lens === "insights" ? INSIGHT_FIELDS : HIGHLIGHT_FIELDS;
}

function findOperator<T>(fields: FieldDef<T>[], condition: Condition) {
  return fields
    .find((field) => field.id === condition.field)
    ?.ops.find((op) => op.id === condition.op);
}

/** Known field and operator with a complete value of the right shape. */
export function isConditionComplete<T>(
  fields: FieldDef<T>[],
  condition: Condition,
): boolean {
  const op = findOperator(fields, condition);
  return !!op && isValueComplete(op.kind, condition.value);
}

/** Active condition count for a lens; the Books lens has no filter. */
export function activeCountFor(lens: Lens, filter: FilterState): number {
  if (lens === "insights") return activeCount(INSIGHT_FIELDS, filter);
  if (lens === "highlights") return activeCount(HIGHLIGHT_FIELDS, filter);
  return 0;
}

/** Number of conditions that will actually narrow the list. */
export function activeCount<T>(
  fields: FieldDef<T>[],
  filter: FilterState,
): number {
  return filter.conditions.filter((c) => isConditionComplete(fields, c)).length;
}

/** Applies the complete conditions with the chosen join; no complete condition keeps everything. */
export function applyFilter<T>(
  items: T[],
  fields: FieldDef<T>[],
  filter: FilterState,
): T[] {
  const active = filter.conditions.filter((c) =>
    isConditionComplete(fields, c),
  );
  if (active.length === 0) return items;
  const tests = active.map((condition) => {
    const op = findOperator(fields, condition)!;
    return (item: T) => op.test(item, condition.value);
  });
  return items.filter((item) =>
    filter.join === "or"
      ? tests.some((test) => test(item))
      : tests.every((test) => test(item)),
  );
}

/** The conditions that are known to the lens and fully filled in. */
export function completeConditions(
  lens: FilterableLens,
  conditions: Condition[],
): Condition[] {
  return lens === "insights"
    ? conditions.filter((c) => isConditionComplete(INSIGHT_FIELDS, c))
    : conditions.filter((c) => isConditionComplete(HIGHLIGHT_FIELDS, c));
}

const valueSchema = z.union([
  z.string(),
  z.number(),
  z.null(),
  z.array(z.union([z.string(), z.number(), z.null()])),
]);

const urlSchema = z.object({
  j: z.enum(["and", "or"]).optional(),
  c: z.array(z.tuple([z.string(), z.string(), valueSchema])).max(25),
});

/** The `filter` URL parameter's value, or "" when no condition is complete. */
export function serializeFilter(lens: Lens, filter: FilterState): string {
  if (lens === "books") return "";
  const complete = completeConditions(lens, filter.conditions);
  if (complete.length === 0) return "";
  return JSON.stringify({
    ...(filter.join === "or" ? { j: "or" } : {}),
    c: complete.map((c) => [c.field, c.op, c.value]),
  });
}

/** Restores a filter from the URL; anything malformed, unknown or incomplete is dropped. */
export function parseFilter(raw: string | null, lens: Lens): FilterState {
  if (!raw || lens === "books") return EMPTY_FILTER;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return EMPTY_FILTER;
  }
  const parsed = urlSchema.safeParse(json);
  if (!parsed.success) return EMPTY_FILTER;
  const conditions = completeConditions(
    lens,
    parsed.data.c.map(([field, op, value]) => ({ field, op, value })),
  );
  return { join: parsed.data.j ?? "and", conditions };
}
