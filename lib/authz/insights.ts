/**
 * Insight reads and writes for the merge-and-enrich pipeline. Every function
 * is scoped by `userId` (or by an id the caller already resolved for that
 * user) — insights are per-user and are never matched across users.
 *
 * The primitives take a transaction handle so the orchestrator
 * (lib/insights/merge-candidates.ts) can run shortlist -> judge -> write
 * under one per-user advisory lock.
 */
import { and, asc, eq, sql } from "drizzle-orm";

import type { Tx } from "@/lib/authz/db-types";
import { db } from "@/lib/db";
import { highlights, insightHighlights, insights } from "@/lib/db/schema";
import type { NormalizedCandidate } from "@/lib/insights/candidate";
import { periodValues } from "@/lib/insights/period";

export type Insight = typeof insights.$inferSelect;

/** Widen both sides of a period by this many years when shortlisting. */
export const SHORTLIST_PERIOD_TOLERANCE_YEARS = 1;
/** When both sides have a location, only shortlist within this distance. */
export const SHORTLIST_MAX_DISTANCE_METERS = 50_000;
export const SHORTLIST_LIMIT = 5;

export type ShortlistedInsight = {
  id: string;
  title: string;
  aliases: string[];
  description: string | null;
  locationName: string | null;
  startsYear: number;
  startsMonth: number | null;
  startsDay: number | null;
  endsYear: number | null;
  endsMonth: number | null;
  endsDay: number | null;
};

/**
 * Serializes insight writes for one user: parallel per-highlight workflows
 * would otherwise each find "no match" for the same real-world thing and both
 * insert it. Released automatically at the end of the transaction.
 */
export async function lockUserInsights(tx: Tx, userId: string): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`,
  );
}

/**
 * The user's existing insights that might be the same real-world thing as the
 * candidate: same type, period overlapping after widening both sides, within
 * range when both have a location, best title/alias trigram match first.
 * Includes hidden insights so a dismissed insight is linked to, not recreated.
 */
export async function shortlistInsightCandidates(
  tx: Tx,
  userId: string,
  candidate: NormalizedCandidate,
): Promise<ShortlistedInsight[]> {
  const { start, end } = periodValues(candidate.period);
  const tolerance = SHORTLIST_PERIOD_TOLERANCE_YEARS;
  const point = candidate.point
    ? sql`ST_SetSRID(ST_MakePoint(${candidate.point.lng}, ${candidate.point.lat}), 4326)::geography`
    : null;
  const locationFilter = point
    ? sql`and (i.location is null or ST_DWithin(i.location::geography, ${point}, ${SHORTLIST_MAX_DISTANCE_METERS}))`
    : sql``;

  const rows = await tx.execute<{
    id: string;
    title: string;
    aliases: string[];
    description: string | null;
    location_name: string | null;
    starts_year: number;
    starts_month: number | null;
    starts_day: number | null;
    ends_year: number | null;
    ends_month: number | null;
    ends_day: number | null;
  }>(sql`
    select i.id, i.title, i.aliases, i.description, i.location_name,
           i.starts_year, i.starts_month, i.starts_day,
           i.ends_year, i.ends_month, i.ends_day
    from v3.insights i
    where i.user_id = ${userId}
      and i.type = ${candidate.type}
      and i.starts_value <= ${end + tolerance}
      and i.ends_value >= ${start - tolerance}
      ${locationFilter}
    order by greatest(
        similarity(i.title, ${candidate.title}),
        coalesce((select max(similarity(a, ${candidate.title})) from unnest(i.aliases) a), 0)
      ) desc,
      i.created_at asc
    limit ${SHORTLIST_LIMIT}
  `);

  return Array.from(rows).map((row) => ({
    id: row.id,
    title: row.title,
    aliases: row.aliases,
    description: row.description,
    locationName: row.location_name,
    startsYear: row.starts_year,
    startsMonth: row.starts_month,
    startsDay: row.starts_day,
    endsYear: row.ends_year,
    endsMonth: row.ends_month,
    endsDay: row.ends_day,
  }));
}

/** Creates a published insight from a candidate and returns its id. */
export async function createInsight(
  tx: Tx,
  userId: string,
  candidate: NormalizedCandidate,
): Promise<string> {
  const location = candidate.point
    ? sql`ST_SetSRID(ST_MakePoint(${candidate.point.lng}, ${candidate.point.lat}), 4326)`
    : null;
  const [created] = await tx
    .insert(insights)
    .values({
      userId,
      type: candidate.type,
      title: candidate.title,
      description: candidate.description,
      ...candidate.period,
      // The geometry column's Drizzle type is a string, but an insert accepts
      // an SQL expression for it.
      location: location as unknown as string | null,
      lastEnrichedAt: null,
    })
    .returning({ id: insights.id });
  return created.id;
}

/**
 * Links a highlight to an insight with what it contributed. Returns false —
 * and changes nothing — when the pair already exists, which is how a replayed
 * merge and a second candidate from the same highlight stay idempotent.
 */
export async function linkHighlightToInsight(
  tx: Tx,
  input: { insightId: string; highlightId: string; contribution: string },
): Promise<boolean> {
  const rows = await tx
    .insert(insightHighlights)
    .values(input)
    .onConflictDoNothing({
      target: [insightHighlights.insightId, insightHighlights.highlightId],
    })
    .returning({ id: insightHighlights.id });
  return rows.length > 0;
}

/** Every contribution to an insight, oldest first. */
export async function listInsightContributions(
  tx: Tx,
  insightId: string,
): Promise<string[]> {
  const rows = await tx
    .select({ contribution: insightHighlights.contribution })
    .from(insightHighlights)
    .where(eq(insightHighlights.insightId, insightId))
    .orderBy(asc(insightHighlights.createdAt), asc(insightHighlights.id));
  return rows.map((row) => row.contribution);
}

export async function getInsightForEnrichment(
  tx: Tx,
  insightId: string,
): Promise<Pick<Insight, "id" | "type" | "title" | "aliases"> | null> {
  const [insight] = await tx
    .select({
      id: insights.id,
      type: insights.type,
      title: insights.title,
      aliases: insights.aliases,
    })
    .from(insights)
    .where(eq(insights.id, insightId))
    .limit(1);
  return insight ?? null;
}

/**
 * Applies an enrichment: the regenerated description, the new title as an
 * alias (unless it already matches the title or an alias, case-insensitive),
 * and `last_enriched_at`. The insight's own title, period and location are
 * never changed here.
 */
export async function applyInsightEnrichment(
  tx: Tx,
  insightId: string,
  input: { description: string; newTitle: string },
): Promise<void> {
  const insight = await getInsightForEnrichment(tx, insightId);
  if (!insight) throw new Error(`Insight ${insightId} not found`);

  const known = new Set(
    [insight.title, ...insight.aliases].map((t) => t.trim().toLowerCase()),
  );
  const aliases = known.has(input.newTitle.trim().toLowerCase())
    ? insight.aliases
    : [...insight.aliases, input.newTitle.trim()];

  await tx
    .update(insights)
    .set({
      description: input.description,
      aliases,
      lastEnrichedAt: new Date(),
    })
    .where(eq(insights.id, insightId));
}

/**
 * Re-reads a highlight inside the lock and, if it hasn't been researched yet,
 * returns it. A highlight already `researched` (a replayed step) returns null.
 */
export async function getHighlightToResearch(
  tx: Tx,
  highlightId: string,
): Promise<{ id: string; userId: string } | null> {
  const [row] = await tx
    .select({
      id: highlights.id,
      userId: highlights.userId,
      status: highlights.status,
    })
    .from(highlights)
    .where(eq(highlights.id, highlightId))
    .limit(1);
  if (!row) throw new Error(`Highlight ${highlightId} not found`);
  if (row.status === "researched" || row.status === "discarded") return null;
  return { id: row.id, userId: row.userId };
}

/** Terminal success status; written in the same transaction as the insights. */
export async function markHighlightResearched(
  tx: Tx,
  highlightId: string,
): Promise<void> {
  await tx
    .update(highlights)
    .set({ status: "researched", researchedAt: new Date() })
    .where(eq(highlights.id, highlightId));
}

/** Runs `fn` in a transaction holding the user's insight lock. */
export async function withUserInsightLock<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await lockUserInsights(tx, userId);
    return fn(tx);
  });
}

/** The highlight's owner, read before taking the lock. */
export async function getHighlightOwner(
  highlightId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ userId: highlights.userId })
    .from(highlights)
    .where(and(eq(highlights.id, highlightId)))
    .limit(1);
  return row?.userId ?? null;
}
