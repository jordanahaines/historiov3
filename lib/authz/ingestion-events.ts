import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { ingestionEvents } from "@/lib/db/schema";

export type IngestionEvent = typeof ingestionEvents.$inferSelect;

export type NewIngestionEventInput = {
  userId: string;
  resendEmailId: string;
  fromAddress: string | null;
  subject: string | null;
};

/**
 * Records an inbound email once. A redelivered webhook (same Resend email id)
 * returns `created: false` and the caller must not start a second workflow.
 */
export async function createIngestionEventIfNew(
  input: NewIngestionEventInput,
): Promise<{ event: IngestionEvent; created: boolean }> {
  const [inserted] = await db
    .insert(ingestionEvents)
    .values({ ...input, source: "kindle_scribe" })
    .onConflictDoNothing({ target: ingestionEvents.resendEmailId })
    .returning();
  if (inserted) return { event: inserted, created: true };

  const [existing] = await db
    .select()
    .from(ingestionEvents)
    .where(eq(ingestionEvents.resendEmailId, input.resendEmailId))
    .limit(1);
  if (!existing) throw new Error("Ingestion event vanished after conflict");
  return { event: existing, created: false };
}

/** For CLIs that import a local PDF with no email behind it. */
export async function createManualIngestionEvent(
  userId: string,
  subject: string,
): Promise<IngestionEvent> {
  const [event] = await db
    .insert(ingestionEvents)
    .values({ userId, source: "kindle_scribe", subject })
    .returning();
  return event;
}

export async function getIngestionEvent(
  id: string,
): Promise<IngestionEvent | null> {
  const [event] = await db
    .select()
    .from(ingestionEvents)
    .where(eq(ingestionEvents.id, id))
    .limit(1);
  return event ?? null;
}

export type IngestionEventPatch = Partial<
  Pick<
    IngestionEvent,
    | "status"
    | "attachmentPath"
    | "bookId"
    | "highlightsFound"
    | "highlightsNew"
    | "error"
    | "completedAt"
  >
>;

export async function updateIngestionEvent(
  id: string,
  patch: IngestionEventPatch,
): Promise<void> {
  await db.update(ingestionEvents).set(patch).where(eq(ingestionEvents.id, id));
}

/**
 * Removes an event whose workflow never started, so a webhook retry is treated
 * as a fresh delivery. Only ever called before any highlight references it.
 */
export async function deleteIngestionEvent(id: string): Promise<void> {
  await db.delete(ingestionEvents).where(eq(ingestionEvents.id, id));
}
