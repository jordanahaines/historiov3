import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { normalizeCandidate } from "@/lib/insights/candidate";

const { db } = await import("@/lib/db");
const { userBooks, highlights } = await import("@/lib/db/schema");
const { getLibrary } = await import("@/lib/authz/library");
const { getNoteImagePathForViewer } = await import("@/lib/authz/highlights");
const { createInsight, linkHighlightToInsight, setInsightStatusForViewer } =
  await import("@/lib/authz/insights");
const {
  createTestUser,
  deleteTestUsers,
  deleteTestBooksByAsin,
  createTestHighlight,
} = await import("@/lib/test-utils/db");

const users: string[] = [];
const asins: string[] = [];
afterAll(async () => {
  await deleteTestUsers(users);
  await deleteTestBooksByAsin(asins);
});

async function seedUser(label: string) {
  const userId = await createTestUser();
  users.push(userId);
  const asin = `LIB${label}${Date.now()}`;
  asins.push(asin);
  const { bookId, highlightId } = await createTestHighlight(userId, { asin });
  const insightId = await db.transaction((tx) =>
    createInsight(
      tx,
      userId,
      normalizeCandidate({
        type: "event",
        title: `Event ${label}`,
        description: "d",
        startsYear: 1453,
        startsMonth: 5,
        startsDay: 29,
        endsYear: null,
        endsMonth: null,
        endsDay: null,
        lat: null,
        lng: null,
      }),
    ),
  );
  await db.transaction((tx) =>
    linkHighlightToInsight(tx, { insightId, highlightId, contribution: "c" }),
  );
  return { userId, bookId, highlightId, insightId };
}

describe("getLibrary", () => {
  it("returns only the viewer's data, with counts and relations", async () => {
    const a = await seedUser("A");
    const b = await seedUser("B");
    const library = await getLibrary(a.userId);

    expect(library.books.map((x) => x.id)).toEqual([a.bookId]);
    expect(library.books[0]).toMatchObject({
      highlightCount: 1,
      insightCount: 1,
    });
    expect(library.highlights.map((x) => x.id)).toEqual([a.highlightId]);
    expect(library.highlights[0].insights.map((i) => i.id)).toEqual([
      a.insightId,
    ]);
    expect(library.insights.map((x) => x.id)).toEqual([a.insightId]);
    expect(library.insights[0]).toMatchObject({
      highlightIds: [a.highlightId],
      bookIds: [a.bookId],
      highlightCount: 1,
    });
    expect(library.insights.some((i) => i.id === b.insightId)).toBe(false);
  });

  it("excludes removed books and their highlights", async () => {
    const a = await seedUser("R");
    await db
      .update(userBooks)
      .set({ status: "removed" })
      .where(eq(userBooks.userId, a.userId));
    const library = await getLibrary(a.userId);
    expect(library.books).toEqual([]);
    expect(library.highlights).toEqual([]);
  });

  it("stops counting a hidden insight", async () => {
    const a = await seedUser("H");
    await setInsightStatusForViewer(a.userId, a.insightId, "hidden");
    const library = await getLibrary(a.userId);
    expect(library.books[0].insightCount).toBe(0);
    expect(library.highlights[0].insights).toEqual([]);
    expect(library.insights[0].status).toBe("hidden");
  });
});

describe("setInsightStatusForViewer", () => {
  it("cannot change another user's insight", async () => {
    const a = await seedUser("O1");
    const b = await seedUser("O2");
    expect(
      await setInsightStatusForViewer(b.userId, a.insightId, "hidden"),
    ).toBe(false);
    const rows = await db.execute<{ status: string }>(
      sql`select status from v3.insights where id = ${a.insightId}`,
    );
    expect(Array.from(rows)[0].status).toBe("published");
    expect(
      await setInsightStatusForViewer(a.userId, a.insightId, "hidden"),
    ).toBe(true);
  });
});

describe("getNoteImagePathForViewer", () => {
  it("returns the path to the owner only", async () => {
    const a = await seedUser("N1");
    const b = await seedUser("N2");
    await db
      .update(highlights)
      .set({ noteImagePath: "u/scan.png" })
      .where(eq(highlights.id, a.highlightId));
    expect(await getNoteImagePathForViewer(a.userId, a.highlightId)).toBe(
      "u/scan.png",
    );
    expect(await getNoteImagePathForViewer(b.userId, a.highlightId)).toBeNull();
  });
});
