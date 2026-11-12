import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { highlights } from "@/lib/db/schema";

export type Highlight = typeof highlights.$inferSelect;

export type NewHighlightInput = {
  userId: string;
  bookId: string;
  ingestionEventId: string | null;
  source: Highlight["source"];
  externalId: string;
  page: number | null;
  chapter: string | null;
  highlightedText: string;
  noteText: string | null;
  noteOrigin: Highlight["noteOrigin"];
  noteImagePath: string | null;
  annotatedAt: Date | null;
};

export async function getHighlightById(id: string): Promise<Highlight | null> {
  const [highlight] = await db
    .select()
    .from(highlights)
    .where(eq(highlights.id, id))
    .limit(1);
  return highlight ?? null;
}

/** External ids this user already has for the book — the dedup lookup. */
export async function findExistingExternalIds(
  userId: string,
  bookId: string,
  source: Highlight["source"],
  externalIds: string[],
): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set();
  const rows = await db
    .select({ externalId: highlights.externalId })
    .from(highlights)
    .where(
      and(
        eq(highlights.userId, userId),
        eq(highlights.bookId, bookId),
        eq(highlights.source, source),
        inArray(highlights.externalId, externalIds),
      ),
    );
  return new Set(rows.map((row) => row.externalId));
}

/**
 * Inserts new highlights, silently skipping any that already exist for the
 * user (the unique dedup key), and returns only the rows actually created.
 * Does not start any processing.
 */
export async function createHighlights(
  inputs: NewHighlightInput[],
): Promise<Highlight[]> {
  if (inputs.length === 0) return [];
  return db.insert(highlights).values(inputs).onConflictDoNothing().returning();
}

/** Highlights from one import that haven't been picked up by a workflow yet. */
export async function listPendingHighlightIdsForEvent(
  ingestionEventId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: highlights.id })
    .from(highlights)
    .where(
      and(
        eq(highlights.ingestionEventId, ingestionEventId),
        eq(highlights.status, "pending"),
      ),
    )
    .orderBy(highlights.page, highlights.createdAt);
  return rows.map((row) => row.id);
}

/** For `pipeline:resume`: highlights stuck short of a terminal status. */
export async function listResumableHighlightIds(
  userId?: string,
): Promise<string[]> {
  const statuses = ["pending", "contextualized", "failed"] as const;
  const rows = await db
    .select({ id: highlights.id })
    .from(highlights)
    .where(
      userId
        ? and(
            inArray(highlights.status, [...statuses]),
            eq(highlights.userId, userId),
          )
        : inArray(highlights.status, [...statuses]),
    );
  return rows.map((row) => row.id);
}

export type ContextualizerAnalysis =
  | { discard: true; discardReason: string }
  | { discard: false; context: string };

/**
 * Records the Contextualizer's decision. Only a highlight that is `pending`
 * (or `failed`, on a resume) is updated, so a replayed step can't overwrite an
 * earlier result. Returns the row as it now stands.
 */
export async function recordContextualizerAnalysis(
  highlightId: string,
  analysis: ContextualizerAnalysis,
): Promise<Highlight> {
  const [updated] = await db
    .update(highlights)
    .set(
      analysis.discard
        ? {
            status: "discarded",
            discardReason: analysis.discardReason,
            context: null,
          }
        : {
            status: "contextualized",
            context: analysis.context,
            discardReason: null,
          },
    )
    .where(
      and(
        eq(highlights.id, highlightId),
        inArray(highlights.status, ["pending", "failed"]),
      ),
    )
    .returning();
  if (updated) return updated;

  const existing = await getHighlightById(highlightId);
  if (!existing) throw new Error(`Highlight ${highlightId} not found`);
  return existing;
}

/** Marks a highlight whose workflow exhausted its retries. */
export async function markHighlightFailed(highlightId: string): Promise<void> {
  await db
    .update(highlights)
    .set({ status: "failed" })
    .where(
      and(
        eq(highlights.id, highlightId),
        inArray(highlights.status, ["pending", "contextualized"]),
      ),
    );
}

/** How many highlights an import created (robust to a retried import step). */
export async function countHighlightsForEvent(
  ingestionEventId: string,
): Promise<number> {
  const rows = await db
    .select({ id: highlights.id })
    .from(highlights)
    .where(eq(highlights.ingestionEventId, ingestionEventId));
  return rows.length;
}
