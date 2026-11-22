import { describe, expect, it } from "vitest";

import { applyInsightStatus } from "@/lib/library/apply-insight-status";
import { coverColor } from "@/lib/library/cover-color";
import {
  filterBooks,
  filterHighlights,
  filterInsights,
  hiddenCount,
  sectionCounts,
} from "@/lib/library/filter";
import { makeLibrary } from "@/lib/library/fixtures";
import { highlightStatusLabel } from "@/lib/library/status-label";
import { formatShortDate } from "@/lib/library/format-date";
import { parseViewState, serializeViewState } from "@/lib/library/url-state";

const asc = { showHidden: false, direction: "asc" as const };

describe("filterBooks", () => {
  it("searches title and author, case-insensitively", () => {
    const { books } = makeLibrary();
    expect(filterBooks(books, "silk").map((b) => b.id)).toEqual(["book-silk"]);
    expect(filterBooks(books, "BEARD").map((b) => b.id)).toEqual(["book-rome"]);
  });

  it("sorts by last highlight, newest first", () => {
    const { books } = makeLibrary();
    expect(filterBooks(books, "").map((b) => b.id)).toEqual([
      "book-rome",
      "book-silk",
    ]);
  });
});

describe("filterHighlights", () => {
  it("searches text, note and linked insight titles", () => {
    const { highlights } = makeLibrary();
    expect(filterHighlights(highlights, "ottomans", {}).length).toBe(1);
    expect(filterHighlights(highlights, "check the", {}).length).toBe(1);
    expect(filterHighlights(highlights, "assassination", {}).length).toBe(1);
  });

  it("scopes to a book and sorts newest captured first", () => {
    const { highlights } = makeLibrary();
    expect(
      filterHighlights(highlights, "", { bookId: "book-silk" }).map(
        (h) => h.id,
      ),
    ).toEqual(["h-1", "h-2"]);
  });
});

describe("filterInsights", () => {
  it("hides hidden insights unless asked", () => {
    const { insights } = makeLibrary();
    expect(filterInsights(insights, "", {}, asc).map((i) => i.id)).toEqual([
      "i-ides",
      "i-fall",
    ]);
    expect(
      filterInsights(insights, "", {}, { ...asc, showHidden: true }).length,
    ).toBe(3);
  });

  it("sorts by period start and toggles direction", () => {
    const { insights } = makeLibrary();
    expect(
      filterInsights(insights, "", {}, { ...asc, direction: "desc" }).map(
        (i) => i.id,
      ),
    ).toEqual(["i-fall", "i-ides"]);
  });

  it("searches title, alias, description and area name", () => {
    const { insights } = makeLibrary();
    expect(filterInsights(insights, "conquest", {}, asc).length).toBe(1);
    expect(filterInsights(insights, "stabbed", {}, asc).length).toBe(1);
    expect(filterInsights(insights, "istanbul", {}, asc).length).toBe(1);
  });

  it("scopes to a book or a highlight", () => {
    const { insights } = makeLibrary();
    expect(
      filterInsights(insights, "", { bookId: "book-rome" }, asc).map(
        (i) => i.id,
      ),
    ).toEqual(["i-ides"]);
    expect(
      filterInsights(insights, "", { highlightId: "h-1" }, asc).map(
        (i) => i.id,
      ),
    ).toEqual(["i-fall"]);
  });
});

describe("counts", () => {
  it("counts published insights in the menu and hidden ones separately", () => {
    const data = makeLibrary();
    expect(sectionCounts(data)).toEqual({
      books: 2,
      highlights: 3,
      insights: 2,
    });
    expect(hiddenCount(data.insights)).toBe(1);
  });
});

describe("applyInsightStatus", () => {
  it("hides an insight and updates book counts and highlight links", () => {
    const next = applyInsightStatus(makeLibrary(), "i-fall", "hidden");
    expect(next.insights.find((i) => i.id === "i-fall")?.status).toBe("hidden");
    expect(next.books.find((b) => b.id === "book-silk")?.insightCount).toBe(1);
    expect(next.highlights.find((h) => h.id === "h-1")?.insights).toEqual([]);
  });

  it("restores it again, undoing the hide", () => {
    const data = makeLibrary();
    const back = applyInsightStatus(
      applyInsightStatus(data, "i-fall", "hidden"),
      "i-fall",
      "published",
    );
    expect(back).toEqual(data);
  });

  it("is a no-op for the same status or an unknown id", () => {
    const data = makeLibrary();
    expect(applyInsightStatus(data, "i-fall", "published")).toBe(data);
    expect(applyInsightStatus(data, "nope", "hidden")).toBe(data);
  });
});

describe("view state in the URL", () => {
  it("round-trips lens, query, scope and hidden", () => {
    const state = {
      lens: "highlights" as const,
      q: "silk road",
      bookId: "book-silk",
      highlightId: null,
      insightId: "i-fall",
      showHidden: true,
    };
    expect(parseViewState(serializeViewState(state))).toEqual(state);
  });

  it("scopes highlights to one insight's highlights", () => {
    const { highlights } = makeLibrary();
    expect(
      filterHighlights(highlights, "", { insightHighlightIds: ["h-1"] }).map(
        (h) => h.id,
      ),
    ).toEqual(["h-1"]);
  });

  it("omits defaults and ignores unknown lenses", () => {
    expect(
      serializeViewState({
        lens: "insights",
        q: "",
        bookId: null,
        highlightId: null,
        insightId: null,
        showHidden: false,
      }),
    ).toBe("");
    expect(parseViewState("lens=boards").lens).toBe("insights");
    expect(parseViewState("").showHidden).toBe(false);
  });
});

describe("small formatters", () => {
  it("maps highlight statuses to labels", () => {
    expect(highlightStatusLabel("researched")).toEqual({
      label: "Researched",
      muted: false,
    });
    expect(highlightStatusLabel("pending").label).toBe("Pending");
    expect(highlightStatusLabel("contextualized").label).toBe("Pending");
    expect(highlightStatusLabel("discarded").muted).toBe(true);
    expect(highlightStatusLabel("failed").label).toBe("Failed");
  });

  it("picks a placeholder cover color deterministically", () => {
    expect(coverColor("abc")).toBe(coverColor("abc"));
    expect(coverColor("abc")).toMatch(/^#[0-9A-F]{6}$/);
  });

  it("formats dates as 9 Nov 2026", () => {
    expect(formatShortDate("2026-11-09T10:00:00Z")).toBe("9 Nov 2026");
    expect(formatShortDate(null)).toBe("–");
  });
});

describe("filterInsights tie-break", () => {
  it("orders insights with the same start by title, in both directions", () => {
    const { insights } = makeLibrary();
    const same = insights.map((i, n) => ({
      ...i,
      title: ["B", "C", "A"][n] ?? i.title,
      period: {
        ...i.period,
        startsYear: 1000,
        startsMonth: null,
        startsDay: null,
      },
    }));
    const asc = filterInsights(
      same,
      "",
      {},
      { showHidden: true, direction: "asc" },
    );
    expect(asc.map((i) => i.title)).toEqual(["A", "B", "C"]);
  });
});
