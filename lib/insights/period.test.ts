import { describe, expect, it } from "vitest";

import { describePeriod, periodValues, type PeriodParts } from "./period";

const base: PeriodParts = {
  startsYear: 1912,
  startsMonth: null,
  startsDay: null,
  endsYear: null,
  endsMonth: null,
  endsDay: null,
};

describe("periodValues", () => {
  it("a bare year spans that whole year", () => {
    expect(periodValues(base)).toEqual({ start: 1912, end: 1913 });
  });

  it("a month spans that month", () => {
    const { start, end } = periodValues({ ...base, startsMonth: 4 });
    expect(start).toBeCloseTo(1912.25, 10);
    expect(end).toBeCloseTo(1912 + 4 / 12, 10);
  });

  it("an explicit end uses the end of its own precision", () => {
    const { start, end } = periodValues({
      ...base,
      startsYear: -753,
      endsYear: 476,
    });
    expect(start).toBe(-753);
    expect(end).toBe(477);
  });

  it("end >= start for a month start with a coarser year end", () => {
    const { start, end } = periodValues({
      ...base,
      startsMonth: 4,
      endsYear: 1912,
    });
    expect(end).toBeGreaterThanOrEqual(start);
  });
});

describe("describePeriod", () => {
  it("formats years, months, days and BCE", () => {
    expect(describePeriod({ ...base, startsMonth: 4, startsDay: 15 })).toBe(
      "April 15, 1912",
    );
    expect(describePeriod({ ...base, startsYear: -753, endsYear: 476 })).toBe(
      "754 BCE – 476",
    );
    expect(describePeriod({ ...base, startsYear: 0 })).toBe("1 BCE");
  });
});
