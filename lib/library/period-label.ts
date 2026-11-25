import type { PeriodParts } from "@/lib/insights/period";
import { formatPeriodParts } from "@/lib/insights/period-format";

/** A period as one line: the start, plus "to <end>" when it has an end. */
export function periodLabel(period: PeriodParts): string {
  const { start, end } = formatPeriodParts(period);
  return end ? `${start} to ${end}` : start;
}
