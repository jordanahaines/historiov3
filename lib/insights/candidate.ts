import type { ResearcherCandidate } from "@/lib/ai/agents/researcher-schema";
import { periodValues, type PeriodParts } from "@/lib/insights/period";

export type InsightType = "event" | "person" | "place" | "concept";

/** A researcher's proposed insight, tagged with the researcher's type. */
export type TypedCandidate = ResearcherCandidate & { type: InsightType };

/** A candidate that is safe to insert: it satisfies every `insights` check. */
export type NormalizedCandidate = {
  type: InsightType;
  title: string;
  description: string | null;
  period: PeriodParts;
  point: { lat: number; lng: number } | null;
};

const validMonth = (m: number | null) =>
  m !== null && Number.isInteger(m) && m >= 1 && m <= 12 ? m : null;
const validDay = (d: number | null) =>
  d !== null && Number.isInteger(d) && d >= 1 && d <= 31 ? d : null;

/**
 * Cleans LLM output so it can't violate the database's period checks: months
 * and days are range-checked, a day without a month is dropped, an end month
 * or day without an end year is dropped, and an end that falls before the
 * start is discarded (the insight keeps just its start). A point needs both
 * coordinates.
 */
export function normalizeCandidate(
  candidate: TypedCandidate,
): NormalizedCandidate {
  const startsMonth = validMonth(candidate.startsMonth);
  const startsDay = startsMonth === null ? null : validDay(candidate.startsDay);

  let period: PeriodParts = {
    startsYear: candidate.startsYear,
    startsMonth,
    startsDay,
    endsYear: null,
    endsMonth: null,
    endsDay: null,
  };

  if (candidate.endsYear !== null) {
    const endsMonth = validMonth(candidate.endsMonth);
    const withEnd: PeriodParts = {
      ...period,
      endsYear: candidate.endsYear,
      endsMonth,
      endsDay: endsMonth === null ? null : validDay(candidate.endsDay),
    };
    const { start, end } = periodValues(withEnd);
    if (end >= start) period = withEnd;
  }

  const point =
    candidate.lat !== null && candidate.lng !== null
      ? { lat: candidate.lat, lng: candidate.lng }
      : null;

  return {
    type: candidate.type,
    title: candidate.title.trim(),
    description: candidate.description?.trim() || null,
    period,
    point,
  };
}

/** What this highlight contributed: the description, else the title. */
export function contributionOf(candidate: NormalizedCandidate): string {
  return candidate.description ?? candidate.title;
}
