import { describe, expect, it } from "vitest";

import { filterHighlights, filterInsights } from "@/lib/library/filter";
import {
  activeCount,
  applyFilter,
  HIGHLIGHT_FIELDS,
  INSIGHT_FIELDS,
  localDay,
  parseFilter,
  serializeFilter,
  type Condition,
  type FilterState,
} from "@/lib/library/filter-conditions";
import { makeLibrary } from "@/lib/library/fixtures";
import type { LibraryHighlight, LibraryInsight } from "@/lib/library/types";
import { parseViewState, serializeViewState } from "@/lib/library/url-state";

const base = makeLibrary();
const noPeriod = {
  startsMonth: null,
  startsDay: null,
  endsYear: null,
  endsMonth: null,
  endsDay: null,
};

function insight(over: Partial<LibraryInsight>): LibraryInsight {
  return { ...base.insights[0]!, ...over };
}

function highlight(over: Partial<LibraryHighlight>): LibraryHighlight {
  return { ...base.highlights[0]!, ...over };
}

const and = (...conditions: Condition[]): FilterState => ({
  join: "and",
  conditions,
});
const c = (
  field: string,
  op: string,
  value: Condition["value"],
): Condition => ({ field, op, value });

const ids = <T extends { id: string }>(items: T[]) => items.map((i) => i.id);

describe("insight conditions", () => {
  const person = insight({ id: "p", type: "person", highlightCount: 3 });
  const place = insight({ id: "pl", type: "place", highlightCount: 0 });
  const event = insight({ id: "e", type: "event", highlightCount: 2 });
  const all = [person, place, event];
  const run = (condition: Condition) =>
    ids(applyFilter(all, INSIGHT_FIELDS, and(condition)));

  it("filters by type, any of and none of", () => {
    expect(run(c("type", "in", ["person", "place"]))).toEqual(["p", "pl"]);
    expect(run(c("type", "notIn", ["person"]))).toEqual(["pl", "e"]);
  });

  it("filters by highlight count", () => {
    expect(run(c("highlights", "gte", 2))).toEqual(["p", "e"]);
    expect(run(c("highlights", "lte", 2))).toEqual(["pl", "e"]);
    expect(run(c("highlights", "eq", 0))).toEqual(["pl"]);
  });

  it("filters by area text and emptiness", () => {
    const rome = insight({ id: "r", locationName: "Rome" });
    const none = insight({ id: "n", locationName: null });
    const blank = insight({ id: "b", locationName: "  " });
    const items = [rome, none, blank];
    const by = (condition: Condition) =>
      ids(applyFilter(items, INSIGHT_FIELDS, and(condition)));
    expect(by(c("area", "contains", "ROM"))).toEqual(["r"]);
    expect(by(c("area", "empty", null))).toEqual(["n", "b"]);
    expect(by(c("area", "notEmpty", null))).toEqual(["r"]);
  });

  it("filters by book", () => {
    const a = insight({ id: "a", bookIds: ["b1", "b2"] });
    const b = insight({ id: "b", bookIds: ["b3"] });
    expect(
      ids(applyFilter([a, b], INSIGHT_FIELDS, and(c("book", "in", ["b2"])))),
    ).toEqual(["a"]);
  });

  describe("period", () => {
    const year = (id: string, startsYear: number, endsYear: number | null) =>
      insight({ id, period: { ...noPeriod, startsYear, endsYear } });
    const items = [
      year("y1300", 1300, null),
      year("span", 1200, 1399),
      year("bc", -200, -100),
      year("late", 1500, null),
    ];
    const by = (condition: Condition) =>
      ids(applyFilter(items, INSIGHT_FIELDS, and(condition)));

    it("overlaps matches any intersection, inclusive of the end year", () => {
      expect(by(c("period", "overlaps", [1300, 1400]))).toEqual([
        "y1300",
        "span",
      ]);
      expect(by(c("period", "overlaps", [1500, 1500]))).toEqual(["late"]);
      expect(by(c("period", "overlaps", [1401, 1499]))).toEqual([]);
    });

    it("overlaps works across BC and swaps a reversed range", () => {
      expect(by(c("period", "overlaps", [-150, -150]))).toEqual(["bc"]);
      expect(by(c("period", "overlaps", [1400, 1300]))).toEqual([
        "y1300",
        "span",
      ]);
    });

    it("before needs the period to end by the start of that year", () => {
      expect(by(c("period", "before", 1300))).toEqual(["bc"]);
      expect(by(c("period", "before", 1301))).toEqual(["y1300", "bc"]);
    });

    it("after needs the period to start on or after that year", () => {
      expect(by(c("period", "after", 1500))).toEqual(["late"]);
      expect(by(c("period", "after", 1300))).toEqual(["y1300", "late"]);
    });
  });
});

describe("highlight conditions", () => {
  const run = (items: LibraryHighlight[], condition: Condition) =>
    ids(applyFilter(items, HIGHLIGHT_FIELDS, and(condition)));

  it("filters by book and by displayed status, Pending covering contextualized", () => {
    const items = [
      highlight({ id: "a", bookId: "b1", status: "researched" }),
      highlight({ id: "b", bookId: "b2", status: "contextualized" }),
      highlight({ id: "c", bookId: "b2", status: "pending" }),
      highlight({ id: "d", bookId: "b2", status: "failed" }),
    ];
    expect(run(items, c("book", "in", ["b1"]))).toEqual(["a"]);
    expect(run(items, c("status", "in", ["pending"]))).toEqual(["b", "c"]);
    expect(run(items, c("status", "in", ["researched", "failed"]))).toEqual([
      "a",
      "d",
    ]);
  });

  it("filters by captured date on the local calendar day, between inclusive", () => {
    const at = (day: number) => new Date(2026, 10, day, 12).toISOString();
    const items = [
      highlight({ id: "a", capturedAt: at(1) }),
      highlight({ id: "b", capturedAt: at(5) }),
      highlight({ id: "c", capturedAt: at(9) }),
    ];
    expect(localDay(at(5))).toBe("2026-11-05");
    expect(run(items, c("captured", "before", "2026-11-05"))).toEqual(["a"]);
    expect(run(items, c("captured", "after", "2026-11-05"))).toEqual(["c"]);
    expect(
      run(items, c("captured", "between", ["2026-11-05", "2026-11-09"])),
    ).toEqual(["b", "c"]);
  });

  it("filters by typed note and handwritten note", () => {
    const items = [
      highlight({ id: "a", noteText: "hmm", hasNoteImage: false }),
      highlight({ id: "b", noteText: "   ", hasNoteImage: true }),
      highlight({ id: "c", noteText: null, hasNoteImage: false }),
    ];
    expect(run(items, c("note", "yes", null))).toEqual(["a"]);
    expect(run(items, c("note", "no", null))).toEqual(["b", "c"]);
    expect(run(items, c("handwritten", "yes", null))).toEqual(["b"]);
    expect(run(items, c("handwritten", "no", null))).toEqual(["a", "c"]);
  });

  it("filters linked insights by title text or presence, with no picker", () => {
    const items = [
      highlight({ id: "a", insights: [{ id: "1", title: "Fall of Rome" }] }),
      highlight({
        id: "b",
        insights: [
          { id: "2", title: "Silk Roads" },
          { id: "3", title: "Marco Polo" },
        ],
      }),
      highlight({ id: "c", insights: [] }),
    ];
    expect(run(items, c("insights", "contains", " polo "))).toEqual(["b"]);
    expect(run(items, c("insights", "empty", null))).toEqual(["c"]);
    expect(run(items, c("insights", "notEmpty", null))).toEqual(["a", "b"]);
  });
});

describe("combining conditions", () => {
  const items = [
    highlight({ id: "a", noteText: "x", status: "researched" }),
    highlight({ id: "b", noteText: "x", status: "failed" }),
    highlight({ id: "c", noteText: null, status: "researched" }),
  ];
  const conditions = [
    c("note", "yes", null),
    c("status", "in", ["researched"]),
  ];

  it("ANDs or ORs the complete conditions", () => {
    expect(
      ids(applyFilter(items, HIGHLIGHT_FIELDS, { join: "and", conditions })),
    ).toEqual(["a"]);
    expect(
      ids(applyFilter(items, HIGHLIGHT_FIELDS, { join: "or", conditions })),
    ).toEqual(["a", "b", "c"]);
  });

  it("ignores incomplete and unknown conditions and does not count them", () => {
    const filter = and(
      c("status", "in", []),
      c("captured", "after", ""),
      c("nope", "in", ["x"]),
      c("status", "bogus", ["x"]),
      c("note", "yes", null),
    );
    expect(ids(applyFilter(items, HIGHLIGHT_FIELDS, filter))).toEqual([
      "a",
      "b",
    ]);
    expect(activeCount(HIGHLIGHT_FIELDS, filter)).toBe(1);
  });

  it("composes with search and scope", () => {
    const { highlights } = makeLibrary();
    const researched = and(c("status", "in", ["researched"]));
    expect(
      ids(
        filterHighlights(highlights, "", { bookId: "book-silk" }, researched),
      ),
    ).toEqual(["h-1"]);
    expect(ids(filterHighlights(highlights, "caesar", {}, researched))).toEqual(
      ["h-3"],
    );
    expect(
      ids(
        filterHighlights(
          highlights,
          "",
          { insightHighlightIds: ["h-1", "h-2"] },
          and(c("status", "in", ["pending"])),
        ),
      ),
    ).toEqual(["h-2"]);
  });

  it("filters insights alongside search and hidden visibility", () => {
    const { insights } = makeLibrary();
    const options = {
      showHidden: true,
      direction: "asc" as const,
      filter: and(c("type", "in", ["event"])),
    };
    expect(ids(filterInsights(insights, "", {}, options))).toEqual([
      "i-ides",
      "i-fall",
    ]);
    expect(ids(filterInsights(insights, "caesar", {}, options))).toEqual([
      "i-ides",
    ]);
    const hiddenConcept = {
      ...options,
      showHidden: false,
      filter: and(c("type", "in", ["concept"])),
    };
    expect(ids(filterInsights(insights, "", {}, hiddenConcept))).toEqual([]);
  });
});

describe("filter in the URL", () => {
  const filter: FilterState = {
    join: "or",
    conditions: [
      c("type", "in", ["event", "person"]),
      c("period", "overlaps", [1200, 1400]),
      c("highlights", "gte", 2),
    ],
  };

  it("round-trips through serialize and parse", () => {
    const state = {
      ...parseViewState(""),
      lens: "insights" as const,
      filter,
    };
    const query = serializeViewState(state);
    expect(query).toContain("filter=");
    expect(parseViewState(query).filter).toEqual(filter);
  });

  it("omits an empty filter and incomplete conditions", () => {
    expect(serializeFilter("insights", and())).toBe("");
    expect(
      serializeFilter(
        "insights",
        and(c("type", "in", []), c("area", "contains", " ")),
      ),
    ).toBe("");
    const mixed = and(c("type", "in", ["event"]), c("highlights", "gte", null));
    expect(parseFilter(serializeFilter("insights", mixed), "insights")).toEqual(
      and(c("type", "in", ["event"])),
    );
  });

  it("drops malformed, unknown or wrong-lens input without throwing", () => {
    for (const raw of [
      "not json",
      "{}",
      '{"c":"x"}',
      '{"c":[["type","in"]]}',
      '{"c":[["nope","in",["x"]]]}',
      '{"c":[["type","in",5]]}',
      '{"c":[["status","in",["researched"]]]}',
    ]) {
      expect(parseFilter(raw, "insights").conditions).toEqual([]);
    }
    expect(
      parseFilter('{"c":[["type","in",["event"]]]}', "books").conditions,
    ).toEqual([]);
    expect(
      parseViewState("lens=books&filter=%7B%22c%22%3A%5B%5D%7D").filter,
    ).toEqual({ join: "and", conditions: [] });
  });
});
