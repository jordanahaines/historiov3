import type { PeriodParts } from "@/lib/insights/period";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

type Point = { year: number; month: number | null; day: number | null };

const isBce = (year: number) => year <= 0;
const displayYear = (year: number) => (isBce(year) ? 1 - year : year);

/** A year-only point carries its era; month and day points only say BCE. */
function formatPoint(point: Point): string {
  const year = displayYear(point.year);
  const bce = isBce(point.year);
  if (point.month === null) return `${year} ${bce ? "BCE" : "CE"}`;
  const month = MONTHS[point.month - 1];
  const date =
    point.day === null ? `${month} ${year}` : `${point.day} ${month} ${year}`;
  return bce ? `${date} BCE` : date;
}

/**
 * Renders a stored Period with the precision it was stored at:
 * `500–800 CE`, `29 May 1453`, `May 1453`, `751 CE`, `44 BCE–14 CE`.
 * Astronomical years: 0 is 1 BCE, -43 is 44 BCE.
 */
export function formatPeriod(period: PeriodParts): string {
  const start: Point = {
    year: period.startsYear,
    month: period.startsMonth,
    day: period.startsDay,
  };
  if (period.endsYear === null) return formatPoint(start);

  const end: Point = {
    year: period.endsYear,
    month: period.endsMonth,
    day: period.endsDay,
  };
  const yearsOnly = start.month === null && end.month === null;
  if (yearsOnly && isBce(start.year) === isBce(end.year)) {
    // Same era on both ends: say it once, at the end ("500–800 CE").
    const era = isBce(end.year) ? "BCE" : "CE";
    return `${displayYear(start.year)}–${displayYear(end.year)} ${era}`;
  }
  return `${formatPoint(start)}–${formatPoint(end)}`;
}
