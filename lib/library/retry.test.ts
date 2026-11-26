import { describe, expect, it } from "vitest";

import { makeLibrary } from "@/lib/library/fixtures";
import {
  applyHighlightStatus,
  canRetryHighlight,
  STALLED_AFTER_MS,
} from "@/lib/library/retry";

const NOW = Date.parse("2026-11-25T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("canRetryHighlight", () => {
  it("always allows a failed highlight, even before the clock is known", () => {
    const highlight = { status: "failed" as const, updatedAt: ago(0) };
    expect(canRetryHighlight(highlight, NOW)).toBe(true);
    expect(canRetryHighlight(highlight, null)).toBe(true);
  });

  it.each(["pending", "contextualized"] as const)(
    "allows %s only once stalled",
    (status) => {
      const at = (ms: number) => ({ status, updatedAt: ago(ms) });
      expect(canRetryHighlight(at(STALLED_AFTER_MS - 1), NOW)).toBe(false);
      expect(canRetryHighlight(at(STALLED_AFTER_MS), NOW)).toBe(true);
      expect(canRetryHighlight(at(STALLED_AFTER_MS), null)).toBe(false);
    },
  );

  it.each(["researched", "discarded"] as const)("never allows %s", (status) => {
    expect(
      canRetryHighlight({ status, updatedAt: ago(STALLED_AFTER_MS * 10) }, NOW),
    ).toBe(false);
  });
});

describe("applyHighlightStatus", () => {
  it("changes only that highlight", () => {
    const data = makeLibrary();
    const next = applyHighlightStatus(data, "h-2", "contextualized", ago(0));
    expect(next.highlights[1]).toMatchObject({
      status: "contextualized",
      updatedAt: ago(0),
    });
    expect(next.highlights[0]).toBe(data.highlights[0]);
  });
});
