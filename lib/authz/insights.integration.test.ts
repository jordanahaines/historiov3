import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import {
  normalizeCandidate,
  type TypedCandidate,
} from "@/lib/insights/candidate";
import { periodValues, type PeriodParts } from "@/lib/insights/period";

const { db } = await import("@/lib/db");
const { insights } = await import("@/lib/db/schema");
const { createInsight, shortlistInsightCandidates } =
  await import("@/lib/authz/insights");
const { createTestUser, deleteTestUsers } = await import("@/lib/test-utils/db");

const users: string[] = [];
afterAll(() => deleteTestUsers(users));

function cand(over: Partial<TypedCandidate> = {}): TypedCandidate {
  return {
    type: "event",
    title: "Battle of Hastings",
    description: null,
    startsYear: 1066,
    startsMonth: 10,
    startsDay: 14,
    endsYear: null,
    endsMonth: null,
    endsDay: null,
    lat: 50.91,
    lng: 0.49,
    ...over,
  };
}

async function seed(userId: string, c: TypedCandidate) {
  return db.transaction((tx) =>
    createInsight(tx, userId, normalizeCandidate(c)),
  );
}
const shortlist = (userId: string, c: TypedCandidate) =>
  db.transaction((tx) =>
    shortlistInsightCandidates(tx, userId, normalizeCandidate(c)),
  );

describe("periodValues matches the generated columns", () => {
  const cases: PeriodParts[] = [
    {
      startsYear: 1912,
      startsMonth: null,
      startsDay: null,
      endsYear: null,
      endsMonth: null,
      endsDay: null,
    },
    {
      startsYear: 1912,
      startsMonth: 4,
      startsDay: null,
      endsYear: null,
      endsMonth: null,
      endsDay: null,
    },
    {
      startsYear: 1912,
      startsMonth: 4,
      startsDay: 15,
      endsYear: null,
      endsMonth: null,
      endsDay: null,
    },
    {
      startsYear: -753,
      startsMonth: null,
      startsDay: null,
      endsYear: 476,
      endsMonth: null,
      endsDay: null,
    },
    {
      startsYear: 1914,
      startsMonth: 7,
      startsDay: 28,
      endsYear: 1918,
      endsMonth: 11,
      endsDay: 11,
    },
    {
      startsYear: 1914,
      startsMonth: 7,
      startsDay: null,
      endsYear: 1918,
      endsMonth: 11,
      endsDay: null,
    },
  ];
  it("agrees with Postgres for every precision combination", async () => {
    const user = await createTestUser();
    users.push(user);
    for (const period of cases) {
      const id = await seed(user, cand({ ...period, lat: null, lng: null }));
      const [row] = await db
        .select({ s: insights.startsValue, e: insights.endsValue })
        .from(insights)
        .where(eq(insights.id, id));
      const { start, end } = periodValues(period);
      expect(row.s).toBeCloseTo(start, 9);
      expect(row.e).toBeCloseTo(end, 9);
    }
  });
});

describe("shortlistInsightCandidates", () => {
  it("filters by type, widened period overlap, distance, and user, ranked by title similarity", async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    users.push(user, other);

    const hastings = await seed(user, cand());
    await seed(
      user,
      cand({ title: "Battle of Hastings (wrong type)", type: "person" }),
    );
    await seed(
      user,
      cand({ title: "Battle of Hastings 1100", startsYear: 1100 }),
    ); // too far in time
    await seed(
      user,
      cand({ title: "Battle of Hastings, Nebraska", lat: 40.58, lng: -98.38 }),
    ); // too far away
    await seed(
      user,
      cand({
        title: "Norman conquest campaign",
        startsYear: 1066,
        startsMonth: 9,
      }),
    ); // in range, low similarity
    await seed(other, cand()); // other user's

    const result = await shortlist(
      user,
      cand({ title: "Hastings battle", startsMonth: 10, startsDay: 14 }),
    );
    const ids = result.map((r) => r.id);

    expect(ids).toContain(hastings);
    expect(ids).toHaveLength(2); // hastings + norman campaign
    expect(ids[0]).toBe(hastings); // best title similarity first
    expect(
      result.every((r) => r.title !== "Battle of Hastings (wrong type)"),
    ).toBe(true);
  });

  it("includes insights with no location when the candidate has one, and skips the distance filter when the candidate has none", async () => {
    const user = await createTestUser();
    users.push(user);
    const placeless = await seed(
      user,
      cand({ title: "Hastings", lat: null, lng: null }),
    );
    const far = await seed(
      user,
      cand({ title: "Hastings far", lat: -33.9, lng: 151.2 }),
    );

    const withPoint = (await shortlist(user, cand())).map((r) => r.id);
    expect(withPoint).toContain(placeless);
    expect(withPoint).not.toContain(far);

    const withoutPoint = (
      await shortlist(user, cand({ lat: null, lng: null }))
    ).map((r) => r.id);
    expect(withoutPoint).toEqual(expect.arrayContaining([placeless, far]));
  });

  it("returns at most 5 results", async () => {
    const user = await createTestUser();
    users.push(user);
    for (let i = 0; i < 7; i++)
      await seed(user, cand({ title: `Hastings ${i}` }));
    expect(await shortlist(user, cand())).toHaveLength(5);
  });

  it("matches on aliases via trigram too", async () => {
    const user = await createTestUser();
    users.push(user);
    const id = await seed(user, cand({ title: "Completely different name" }));
    await db
      .update(insights)
      .set({ aliases: sql`ARRAY['Battle of Hastings']::text[]` })
      .where(eq(insights.id, id));
    const [first] = await shortlist(user, cand());
    expect(first.id).toBe(id);
  });
});
