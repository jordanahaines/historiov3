import { describe, expect, it } from "vitest";

import {
  DEFAULT_VIEW_STATE,
  parseViewState,
  serializeViewState,
} from "@/lib/library/url-state";

describe("drawer in the URL", () => {
  it("parses the drawer param", () => {
    expect(parseViewState("drawer=i-fall").drawerId).toBe("i-fall");
    expect(parseViewState("").drawerId).toBeNull();
  });

  it("serializes the drawer param and omits it when null", () => {
    expect(
      serializeViewState({ ...DEFAULT_VIEW_STATE, drawerId: "i-fall" }),
    ).toBe("drawer=i-fall");
    expect(serializeViewState(DEFAULT_VIEW_STATE)).toBe("");
  });

  it("is independent of the insight scope param", () => {
    const state = {
      ...DEFAULT_VIEW_STATE,
      insightId: "i-ides",
      drawerId: "i-fall",
    };
    const parsed = parseViewState(serializeViewState(state));
    expect(parsed.insightId).toBe("i-ides");
    expect(parsed.drawerId).toBe("i-fall");
    expect(
      parseViewState(
        serializeViewState({ ...DEFAULT_VIEW_STATE, insightId: "i-ides" }),
      ).drawerId,
    ).toBeNull();
  });
});
