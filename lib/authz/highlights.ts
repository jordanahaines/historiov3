import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { highlights, userBooks } from "@/lib/db/schema";
import { STALLED_AFTER_MS } from "@/lib/library/retry";

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

/**
 * The storage path of a handwritten-note scan, but only if the highlight
 * belongs to the viewer. This is the guard for signing scan URLs: storage is
 * accessed with the secret key, so ownership must be checked here.
 */
export async function getNoteImagePathForViewer(
  viewerId: string,
  highlightId: string,
): Promise<string | null> {
  const [row] = await db
    .select({ path: highlights.noteImagePath })
    .from(highlights)
    .innerJoin(
      userBooks,
      and(
        eq(userBooks.userId, highlights.userId),
        eq(userBooks.bookId, highlights.bookId),
        eq(userBooks.status, "active"),
      ),
    )
    .where(and(eq(highlights.id, highlightId), eq(highlights.userId, viewerId)))
    .limit(1);
  return row?.path ?? null;
}

/** The viewer's highlight, in a book still in their library. */
export async function getHighlightStatusForViewer(
  viewerId: string,
  highlightId: string,
): Promise<{ status: Highlight["status"]; updatedAt: Date } | null> {
  const [row] = await db
    .select({ status: highlights.status, updatedAt: highlights.updatedAt })
    .from(highlights)
    .innerJoin(
      userBooks,
      and(
        eq(userBooks.userId, highlights.userId),
        eq(userBooks.bookId, highlights.bookId),
        eq(userBooks.status, "active"),
      ),
    )
    .where(and(eq(highlights.id, highlightId), eq(highlights.userId, viewerId)))
    .limit(1);
  return row ?? null;
}

export type HighlightRetryClaim =
  | {
      outcome: "started";
      /** What the row was before the claim, to undo it if nothing starts. */
      previousStatus: Highlight["status"];
      status: Highlight["status"];
      updatedAt: Date;
    }
  | { outcome: "not_found" }
  | { outcome: "not_retryable" };

/**
 * Atomically claims a retry: a `failed` highlight goes back to the step it
 * reached, and a stalled `pending` / `contextualized` one has `updated_at`
 * bumped. Either way a second claim finds nothing to take, so two clicks can't
 * start two runs. The row lock makes a concurrent claim re-check the new row.
 */
export async function claimHighlightRetryForViewer(
  viewerId: string,
  highlightId: string,
  now: Date = new Date(),
): Promise<HighlightRetryClaim> {
  const stalledBefore = new Date(now.getTime() - STALLED_AFTER_MS);
  const rows = await db.execute<{
    previous_status: Highlight["status"];
    status: Highlight["status"];
  }>(sql`
    with target as (
      select h.id, h.status
      from v3.highlights h
      join v3.user_books ub
        on ub.user_id = h.user_id and ub.book_id = h.book_id
        and ub.status = 'active'
      where h.id = ${highlightId} and h.user_id = ${viewerId}
        and (
          h.status = 'failed'
          or (
            h.status in ('pending', 'contextualized')
            and h.updated_at <= ${stalledBefore.toISOString()}::timestamptz
          )
        )
      for update of h
    )
    update v3.highlights h
    set status = case
          when target.status <> 'failed' then h.status
          when h.context is null then 'pending'::v3.highlight_status
          else 'contextualized'::v3.highlight_status
        end,
        updated_at = ${now.toISOString()}::timestamptz
    from target
    where h.id = target.id
    returning target.status as previous_status, h.status as status
  `);
  const [claimed] = Array.from(rows);
  if (claimed) {
    return {
      outcome: "started",
      previousStatus: claimed.previous_status,
      status: claimed.status,
      updatedAt: now,
    };
  }
  const existing = await getHighlightStatusForViewer(viewerId, highlightId);
  return { outcome: existing ? "not_retryable" : "not_found" };
}

/**
 * Undoes a claim whose workflow never started, so the highlight is retryable
 * again at once. A no-op if anything else has changed the row since.
 */
export async function releaseHighlightRetry(
  highlightId: string,
  claim: { previousStatus: Highlight["status"]; status: Highlight["status"] },
): Promise<void> {
  const stalledAt = new Date(Date.now() - STALLED_AFTER_MS);
  await db
    .update(highlights)
    .set({ status: claim.previousStatus, updatedAt: stalledAt })
    .where(
      and(eq(highlights.id, highlightId), eq(highlights.status, claim.status)),
    );
}
