import type { PeriodParts } from "@/lib/insights/period";

type Point = { year: number; month: number | null; day: number | null };

const isBce = (year: number) => year <= 0;
const displayYear = (year: number) => (isBce(year) ? 1 - year : year);

const pad = (n: number) => String(n).padStart(2, "0");

/** `mm/dd/yyyy`, `mm/yyyy` or `yyyy` by stored precision; BCE years end in " BC". */
function formatPoint(point: Point): string {
  const year = `${displayYear(point.year)}${isBce(point.year) ? " BC" : ""}`;
  if (point.month === null) return year;
  return point.day === null
    ? `${pad(point.month)}/${year}`
    : `${pad(point.month)}/${pad(point.day)}/${year}`;
}

/**
 * A stored Period as display text: the start date, and the end date (if the
 * period has one) separately so the UI can show it as help text.
 * Astronomical years: 0 is 1 BC, -43 is 44 BC.
 */
export function formatPeriodParts(period: PeriodParts): {
  start: string;
  end: string | null;
} {
  const start = formatPoint({
    year: period.startsYear,
    month: period.startsMonth,
    day: period.startsDay,
  });
  if (period.endsYear === null) return { start, end: null };
  const end = formatPoint({
    year: period.endsYear,
    month: period.endsMonth,
    day: period.endsDay,
  });
  return { start, end };
}
