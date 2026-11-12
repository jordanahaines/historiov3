import { describe, expect, it } from "vitest";

import {
  contributionOf,
  normalizeCandidate,
  type TypedCandidate,
} from "./candidate";

const base: TypedCandidate = {
  type: "event",
  title: "  Titanic sinking ",
  description: " The ship sank. ",
  startsYear: 1912,
  startsMonth: 4,
  startsDay: 15,
  endsYear: null,
  endsMonth: null,
  endsDay: null,
  lat: 41.7,
  lng: -49.9,
};

describe("normalizeCandidate", () => {
  it("trims text and builds a point", () => {
    const n = normalizeCandidate(base);
    expect(n.title).toBe("Titanic sinking");
    expect(n.description).toBe("The ship sank.");
    expect(n.point).toEqual({ lat: 41.7, lng: -49.9 });
  });

  it("drops out-of-range months and the day that depended on them", () => {
    const n = normalizeCandidate({ ...base, startsMonth: 13, startsDay: 5 });
    expect(n.period.startsMonth).toBeNull();
    expect(n.period.startsDay).toBeNull();
  });

  it("drops a day without a month", () => {
    const n = normalizeCandidate({ ...base, startsMonth: null, startsDay: 9 });
    expect(n.period.startsDay).toBeNull();
  });

  it("drops end month/day when there is no end year", () => {
    const n = normalizeCandidate({ ...base, endsMonth: 5, endsDay: 3 });
    expect(n.period).toMatchObject({
      endsYear: null,
      endsMonth: null,
      endsDay: null,
    });
  });

  it("keeps a valid end", () => {
    const n = normalizeCandidate({ ...base, endsYear: 1913, endsMonth: 2 });
    expect(n.period).toMatchObject({ endsYear: 1913, endsMonth: 2 });
  });

  it("discards an end that falls before the start", () => {
    const n = normalizeCandidate({ ...base, endsYear: 1900 });
    expect(n.period.endsYear).toBeNull();
  });

  it("needs both coordinates for a point", () => {
    expect(normalizeCandidate({ ...base, lng: null }).point).toBeNull();
  });
});

describe("contributionOf", () => {
  it("uses the description, falling back to the title", () => {
    expect(contributionOf(normalizeCandidate(base))).toBe("The ship sank.");
    expect(
      contributionOf(normalizeCandidate({ ...base, description: null })),
    ).toBe("Titanic sinking");
  });
});
