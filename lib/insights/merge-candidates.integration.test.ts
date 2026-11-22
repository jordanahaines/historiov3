import "dotenv/config";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it, vi } from "vitest";

import type { MergeDeps } from "@/lib/insights/merge-candidates";
import type { TypedCandidate } from "@/lib/insights/candidate";

const { db } = await import("@/lib/db");
const { highlights, insightHighlights, insights } =
  await import("@/lib/db/schema");
const { mergeCandidatesForHighlight } =
  await import("@/lib/insights/merge-candidates");
const {
  createTestUser,
  deleteTestUsers,
  deleteTestBooksByAsin,
  createTestHighlight,
} = await import("@/lib/test-utils/db");

const users: string[] = [];
const asins: string[] = [];
const asin = () => {
  const a = `TEST-${randomUUID()}`;
  asins.push(a);
  return a;
};

afterAll(async () => {
  await deleteTestUsers(users);
  await deleteTestBooksByAsin(asins);
});

const titanic: TypedCandidate = {
  type: "event",
  title: "Titanic sinking",
  description: "The liner struck an iceberg.",
  startsYear: 1912,
  startsMonth: 4,
  startsDay: 15,
  endsYear: null,
  endsMonth: null,
  endsDay: null,
  lat: 41.7,
  lng: -49.9,
};
const titanicAgain: TypedCandidate = {
  ...titanic,
  title: "Sinking of the Titanic",
  description: "More than 1,500 people died.",
};

function deps(judgeAnswer: "match" | "low" | "throw" | "none" = "match") {
  const judge = vi.fn<MergeDeps["judge"]>(async () => {
    if (judgeAnswer === "throw") throw new Error("model down");
    if (judgeAnswer === "none") return { matchIndex: null, confidence: "high" };
    return {
      matchIndex: 1,
      confidence: judgeAnswer === "low" ? "low" : "high",
    };
  });
  const synthesize = vi.fn<MergeDeps["synthesize"]>(async (input) => ({
    description: `SYNTH: ${input.contributions.join(" | ")}`,
  }));
  return { judge, synthesize } satisfies MergeDeps;
}

async function newUser() {
  const id = await createTestUser();
  users.push(id);
  return id;
}

async function userInsights(userId: string) {
  return db.select().from(insights).where(eq(insights.userId, userId));
}

describe("mergeCandidatesForHighlight", () => {
  it("creates a published insight with a point and a contribution when nothing matches", async () => {
    const user = await newUser();
    const h = await createTestHighlight(user, { asin: asin() });
    const d = deps();

    const outcome = await mergeCandidatesForHighlight(
      h.highlightId,
      [titanic],
      d,
    );

    expect(outcome).toMatchObject({ skipped: false, created: 1, enriched: 0 });
    expect(d.judge).not.toHaveBeenCalled(); // empty shortlist: no model call
    const [insight] = await userInsights(user);
    expect(insight).toMatchObject({
      type: "event",
      status: "published",
      title: "Titanic sinking",
      description: "The liner struck an iceberg.",
      startsYear: 1912,
    });
    const [geo] = await db.execute<{ g: string }>(
      sql`select ST_AsGeoJSON(location) as g from v3.insights where id = ${insight.id}`,
    );
    expect(JSON.parse(geo.g).coordinates).toEqual([-49.9, 41.7]);
    const [row] = await db
      .select()
      .from(highlights)
      .where(eq(highlights.id, h.highlightId));
    expect(row.status).toBe("researched");
    expect(row.researchedAt).not.toBeNull();
  });

  it("merges 'Sinking of the Titanic' from a second book into one enriched insight", async () => {
    const user = await newUser();
    const a = await createTestHighlight(user, { asin: asin() });
    const b = await createTestHighlight(user, { asin: asin() });
    const d = deps("match");

    await mergeCandidatesForHighlight(a.highlightId, [titanic], d);
    const outcome = await mergeCandidatesForHighlight(
      b.highlightId,
      [titanicAgain],
      d,
    );

    expect(outcome).toMatchObject({ created: 0, enriched: 1 });
    const all = await userInsights(user);
    expect(all).toHaveLength(1);
    const [insight] = all;
    expect(insight.title).toBe("Titanic sinking"); // the first title is kept
    expect(insight.aliases).toEqual(["Sinking of the Titanic"]);
    expect(insight.description).toBe(
      "SYNTH: The liner struck an iceberg. | More than 1,500 people died.",
    );
    expect(insight.lastEnrichedAt).not.toBeNull();

    const links = await db
      .select()
      .from(insightHighlights)
      .where(eq(insightHighlights.insightId, insight.id));
    expect(links.map((l) => l.highlightId).sort()).toEqual(
      [a.highlightId, b.highlightId].sort(),
    );
    // Both books are reachable through the lineage.
    const bookRows = await db.execute<{ book_id: string }>(
      sql`select distinct h.book_id from v3.insight_highlights ih join v3.highlights h on h.id = ih.highlight_id where ih.insight_id = ${insight.id}`,
    );
    expect(
      Array.from(bookRows)
        .map((r) => r.book_id)
        .sort(),
    ).toEqual([a.bookId, b.bookId].sort());
  });

  it("is idempotent: re-running a researched highlight changes nothing", async () => {
    const user = await newUser();
    const h = await createTestHighlight(user, { asin: asin() });
    const d = deps();
    await mergeCandidatesForHighlight(h.highlightId, [titanic], d);

    const again = await mergeCandidatesForHighlight(
      h.highlightId,
      [titanic],
      d,
    );

    expect(again.skipped).toBe(true);
    expect(await userInsights(user)).toHaveLength(1);
  });

  it("creates a new insight when the judge is not confident", async () => {
    const user = await newUser();
    const a = await createTestHighlight(user, { asin: asin() });
    const b = await createTestHighlight(user, { asin: asin() });
    await mergeCandidatesForHighlight(a.highlightId, [titanic], deps());
    await mergeCandidatesForHighlight(
      b.highlightId,
      [titanicAgain],
      deps("low"),
    );
    expect(await userInsights(user)).toHaveLength(2);
  });

  it("creates a new insight when the judge errors", async () => {
    const user = await newUser();
    const a = await createTestHighlight(user, { asin: asin() });
    const b = await createTestHighlight(user, { asin: asin() });
    await mergeCandidatesForHighlight(a.highlightId, [titanic], deps());
    await mergeCandidatesForHighlight(
      b.highlightId,
      [titanicAgain],
      deps("throw"),
    );
    expect(await userInsights(user)).toHaveLength(2);
  });

  it("links to a hidden insight without un-hiding it", async () => {
    const user = await newUser();
    const a = await createTestHighlight(user, { asin: asin() });
    const b = await createTestHighlight(user, { asin: asin() });
    await mergeCandidatesForHighlight(a.highlightId, [titanic], deps());
    await db
      .update(insights)
      .set({ status: "hidden" })
      .where(eq(insights.userId, user));

    await mergeCandidatesForHighlight(
      b.highlightId,
      [titanicAgain],
      deps("match"),
    );

    const all = await userInsights(user);
    expect(all).toHaveLength(1);
    expect(all[0].status).toBe("hidden");
  });

  it("never matches across users", async () => {
    const u1 = await newUser();
    const u2 = await newUser();
    const a = await createTestHighlight(u1, { asin: asin() });
    const b = await createTestHighlight(u2, { asin: asin() });
    const d = deps("match");
    await mergeCandidatesForHighlight(a.highlightId, [titanic], d);
    await mergeCandidatesForHighlight(b.highlightId, [titanic], d);

    expect(d.judge).not.toHaveBeenCalled();
    expect(await userInsights(u1)).toHaveLength(1);
    expect(await userInsights(u2)).toHaveLength(1);
  });

  it("counts a second candidate that resolves to the highlight's own insight as already linked", async () => {
    const user = await newUser();
    const h = await createTestHighlight(user, { asin: asin() });
    const outcome = await mergeCandidatesForHighlight(
      h.highlightId,
      [titanic, titanicAgain],
      deps("match"),
    );
    expect(outcome).toMatchObject({
      created: 1,
      enriched: 0,
      alreadyLinked: 1,
    });
    expect(await userInsights(user)).toHaveLength(1);
  });

  it("serializes concurrent merges for one user so the same thing is created once", async () => {
    const user = await newUser();
    const hs = await Promise.all(
      [0, 1, 2].map(() => createTestHighlight(user, { asin: asin() })),
    );
    const d = deps("match");

    await Promise.all(
      hs.map((h, i) =>
        mergeCandidatesForHighlight(
          h.highlightId,
          [{ ...titanic, title: `Titanic variant ${i}` }],
          d,
        ),
      ),
    );

    const all = await userInsights(user);
    expect(all).toHaveLength(1);
    const links = await db
      .select()
      .from(insightHighlights)
      .where(eq(insightHighlights.insightId, all[0].id));
    expect(links).toHaveLength(3);
  });

  it("accepts LLM-style messy dates without violating the insight checks", async () => {
    const user = await newUser();
    const h = await createTestHighlight(user, { asin: asin() });
    await mergeCandidatesForHighlight(
      h.highlightId,
      [
        {
          ...titanic,
          startsMonth: 13,
          startsDay: 40,
          endsYear: 1900,
          endsMonth: 7,
          lat: null,
          lng: null,
        },
      ],
      deps(),
    );
    const [insight] = await userInsights(user);
    expect(insight).toMatchObject({
      startsMonth: null,
      startsDay: null,
      endsYear: null,
    });
  });
});
