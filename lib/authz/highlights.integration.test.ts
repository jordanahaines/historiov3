import "dotenv/config";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

const { db } = await import("@/lib/db");
const { highlights, userBooks } = await import("@/lib/db/schema");
const {
  claimHighlightRetryForViewer,
  getHighlightById,
  releaseHighlightRetry,
} = await import("@/lib/authz/highlights");
const { getHighlightToResearch } = await import("@/lib/authz/insights");
const {
  createTestUser,
  deleteTestUsers,
  deleteTestBooksByAsin,
  createTestHighlight,
} = await import("@/lib/test-utils/db");

type Status = (typeof highlights.$inferSelect)["status"];

const users: string[] = [];
const asins: string[] = [];
afterAll(async () => {
  await deleteTestUsers(users);
  await deleteTestBooksByAsin(asins);
});

const HOUR_AGO = () => new Date(Date.now() - 60 * 60_000);

async function seed(
  status: Status,
  opts: { updatedAt?: Date; context?: string } = {},
) {
  const userId = await createTestUser();
  users.push(userId);
  const asin = `RTY${users.length}${Date.now()}`;
  asins.push(asin);
  const { highlightId } = await createTestHighlight(userId, { asin });
  await db
    .update(highlights)
    .set({
      status,
      context: opts.context ?? null,
      updatedAt: opts.updatedAt ?? new Date(),
    })
    .where(eq(highlights.id, highlightId));
  return { userId, highlightId };
}

describe("claimHighlightRetryForViewer", () => {
  it("returns a failed highlight to pending, ready for the merge step", async () => {
    const { userId, highlightId } = await seed("failed");
    const claim = await claimHighlightRetryForViewer(userId, highlightId);
    expect(claim).toMatchObject({
      outcome: "started",
      previousStatus: "failed",
      status: "pending",
    });
    expect((await getHighlightById(highlightId))?.status).toBe("pending");
    expect(
      await db.transaction((tx) => getHighlightToResearch(tx, highlightId)),
    ).not.toBeNull();
  });

  it("keeps a contextualized failure's progress", async () => {
    const { userId, highlightId } = await seed("failed", { context: "c" });
    await claimHighlightRetryForViewer(userId, highlightId);
    expect(await getHighlightById(highlightId)).toMatchObject({
      status: "contextualized",
      context: "c",
    });
  });

  it.each(["pending", "contextualized"] as const)(
    "bumps a stalled %s highlight so it can't be claimed twice",
    async (status) => {
      const { userId, highlightId } = await seed(status, {
        updatedAt: HOUR_AGO(),
      });
      expect(
        await claimHighlightRetryForViewer(userId, highlightId),
      ).toMatchObject({ outcome: "started", status });
      const row = await getHighlightById(highlightId);
      expect(Date.now() - row!.updatedAt.getTime()).toBeLessThan(5 * 60_000);
      expect(await claimHighlightRetryForViewer(userId, highlightId)).toEqual({
        outcome: "not_retryable",
      });
    },
  );

  it.each(["pending", "researched", "discarded"] as const)(
    "refuses a fresh pending or terminal row (%s) without writing",
    async (status) => {
      const updatedAt = status === "pending" ? new Date() : HOUR_AGO();
      const { userId, highlightId } = await seed(status, { updatedAt });
      expect(await claimHighlightRetryForViewer(userId, highlightId)).toEqual({
        outcome: "not_retryable",
      });
      const row = await getHighlightById(highlightId);
      expect(row).toMatchObject({ status, updatedAt });
    },
  );

  it("hides other users' highlights and removed books", async () => {
    const mine = await seed("failed");
    const other = await seed("failed");
    expect(
      await claimHighlightRetryForViewer(other.userId, mine.highlightId),
    ).toEqual({ outcome: "not_found" });
    await db
      .update(userBooks)
      .set({ status: "removed" })
      .where(eq(userBooks.userId, mine.userId));
    expect(
      await claimHighlightRetryForViewer(mine.userId, mine.highlightId),
    ).toEqual({ outcome: "not_found" });
    expect((await getHighlightById(mine.highlightId))?.status).toBe("failed");
  });

  it("lets exactly one of two concurrent claims through", async () => {
    const { userId, highlightId } = await seed("failed");
    const outcomes = await Promise.all([
      claimHighlightRetryForViewer(userId, highlightId),
      claimHighlightRetryForViewer(userId, highlightId),
    ]);
    expect(outcomes.map((c) => c.outcome).sort()).toEqual([
      "not_retryable",
      "started",
    ]);
  });

  it("can be claimed again after a release", async () => {
    const { userId, highlightId } = await seed("failed");
    const claim = await claimHighlightRetryForViewer(userId, highlightId);
    if (claim.outcome !== "started") throw new Error("not claimed");
    await releaseHighlightRetry(highlightId, claim);
    expect((await getHighlightById(highlightId))?.status).toBe("failed");
    expect(
      (await claimHighlightRetryForViewer(userId, highlightId)).outcome,
    ).toBe("started");
  });
});
