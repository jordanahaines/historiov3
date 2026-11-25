import { describe, expect, it } from "vitest";

import type { PeriodParts } from "@/lib/insights/period";
import { formatPeriodParts } from "@/lib/insights/period-format";

const p = (over: Partial<PeriodParts>): PeriodParts => ({
  startsYear: 0,
  startsMonth: null,
  startsDay: null,
  endsYear: null,
  endsMonth: null,
  endsDay: null,
  ...over,
});

describe("formatPeriodParts", () => {
  it("renders mm/dd/yyyy, mm/yyyy and yyyy by stored precision", () => {
    expect(
      formatPeriodParts(p({ startsYear: 1453, startsMonth: 5, startsDay: 29 })),
    ).toEqual({ start: "05/29/1453", end: null });
    expect(
      formatPeriodParts(p({ startsYear: 1453, startsMonth: 5 })).start,
    ).toBe("05/1453");
    expect(formatPeriodParts(p({ startsYear: 751 })).start).toBe("751");
  });

  it("converts astronomical years to BC (0 is 1 BC, -43 is 44 BC)", () => {
    expect(formatPeriodParts(p({ startsYear: 0 })).start).toBe("1 BC");
    expect(
      formatPeriodParts(p({ startsYear: -43, startsMonth: 3, startsDay: 15 }))
        .start,
    ).toBe("03/15/44 BC");
  });

  it("returns the end separately when there is one", () => {
    expect(formatPeriodParts(p({ startsYear: 500, endsYear: 800 }))).toEqual({
      start: "500",
      end: "800",
    });
    expect(formatPeriodParts(p({ startsYear: -43, endsYear: 14 }))).toEqual({
      start: "44 BC",
      end: "14",
    });
    expect(
      formatPeriodParts(
        p({
          startsYear: 1453,
          startsMonth: 4,
          endsYear: 1453,
          endsMonth: 5,
          endsDay: 3,
        }),
      ),
    ).toEqual({ start: "04/1453", end: "05/03/1453" });
  });

  it("treats a null end as no end", () => {
    expect(
      formatPeriodParts(p({ startsYear: 1912, startsMonth: 4 })).end,
    ).toBeNull();
  });
});
