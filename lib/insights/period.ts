/**
 * A Period as stored on an insight: astronomical year (1 BCE = 0) plus optional
 * month/day for the start and end. A missing end means the period is just the
 * start's own precision unit ("April 1912" = that month).
 */
export type PeriodParts = {
  startsYear: number;
  startsMonth: number | null;
  startsDay: number | null;
  endsYear: number | null;
  endsMonth: number | null;
  endsDay: number | null;
};

const startValue = (y: number, m: number | null, d: number | null) =>
  y + ((m ?? 1) - 1) / 12 + ((d ?? 1) - 1) / 372;

const endValue = (y: number, m: number | null, d: number | null) => {
  if (m === null) return y + 1;
  if (d === null) return y + m / 12;
  return y + (m - 1) / 12 + d / 372;
};

/**
 * The numeric [start, end) a Period occupies on one axis. Must stay identical
 * to the generated `starts_value` / `ends_value` columns in lib/db/schema.ts —
 * an integration test compares them against the database.
 */
export function periodValues(period: PeriodParts): {
  start: number;
  end: number;
} {
  const start = startValue(
    period.startsYear,
    period.startsMonth,
    period.startsDay,
  );
  const end =
    period.endsYear === null
      ? endValue(period.startsYear, period.startsMonth, period.startsDay)
      : endValue(period.endsYear, period.endsMonth, period.endsDay);
  return { start, end };
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function describePoint(
  year: number,
  month: number | null,
  day: number | null,
): string {
  const era = year <= 0 ? `${1 - year} BCE` : String(year);
  if (month === null) return era;
  const monthName = MONTHS[month - 1];
  return day === null ? `${monthName} ${era}` : `${monthName} ${day}, ${era}`;
}

/** Human-readable period for prompts: "April 1912" or "753 BCE – 476". */
export function describePeriod(period: PeriodParts): string {
  const start = describePoint(
    period.startsYear,
    period.startsMonth,
    period.startsDay,
  );
  if (period.endsYear === null) return start;
  const end = describePoint(period.endsYear, period.endsMonth, period.endsDay);
  return `${start} – ${end}`;
}
