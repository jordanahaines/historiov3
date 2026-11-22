import { describe, expect, it } from "vitest";

import type { PeriodParts } from "@/lib/insights/period";
import { formatPeriod } from "@/lib/insights/period-format";

const p = (over: Partial<PeriodParts>): PeriodParts => ({
  startsYear: 0,
  startsMonth: null,
  startsDay: null,
  endsYear: null,
  endsMonth: null,
  endsDay: null,
  ...over,
});

describe("formatPeriod", () => {
  it("renders a CE range with the era once", () => {
    expect(formatPeriod(p({ startsYear: 500, endsYear: 800 }))).toBe(
      "500–800 CE",
    );
    expect(formatPeriod(p({ startsYear: 1346, endsYear: 1347 }))).toBe(
      "1346–1347 CE",
    );
  });

  it("renders a single year with its era", () => {
    expect(formatPeriod(p({ startsYear: 751 }))).toBe("751 CE");
  });

  it("renders day and month precision without a CE suffix", () => {
    expect(
      formatPeriod(p({ startsYear: 1453, startsMonth: 5, startsDay: 29 })),
    ).toBe("29 May 1453");
    expect(formatPeriod(p({ startsYear: 1453, startsMonth: 5 }))).toBe(
      "May 1453",
    );
  });

  it("converts astronomical years to BCE (0 is 1 BCE, -43 is 44 BCE)", () => {
    expect(formatPeriod(p({ startsYear: 0 }))).toBe("1 BCE");
    expect(formatPeriod(p({ startsYear: -43 }))).toBe("44 BCE");
    expect(formatPeriod(p({ startsYear: -752, endsYear: -508 }))).toBe(
      "753–509 BCE",
    );
  });

  it("renders a range that crosses the era boundary", () => {
    expect(formatPeriod(p({ startsYear: -43, endsYear: 14 }))).toBe(
      "44 BCE–14 CE",
    );
  });

  it("renders mixed precision ends", () => {
    expect(
      formatPeriod(
        p({ startsYear: 1453, startsMonth: 4, endsYear: 1453, endsMonth: 5 }),
      ),
    ).toBe("Apr 1453–May 1453");
    expect(
      formatPeriod(p({ startsYear: 1453, startsMonth: 5, endsYear: 1455 })),
    ).toBe("May 1453–1455 CE");
  });

  it("treats a null end as the start's own precision", () => {
    expect(formatPeriod(p({ startsYear: 1912, startsMonth: 4 }))).toBe(
      "Apr 1912",
    );
  });
});
