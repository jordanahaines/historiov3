import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import { resolveMatch, run } from "./insight-matcher";

function mockModel(responseObject: unknown) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(responseObject) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: {
          total: 10,
          noCache: 10,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      },
      warnings: [],
    }),
  });
}

const input = {
  candidate: {
    type: "event",
    title: "Sinking of the Titanic",
    description: null,
    period: "April 1912",
    locationHint: null,
  },
  options: [
    {
      title: "Titanic sinking",
      aliases: [],
      description: null,
      period: "1912",
      locationName: null,
    },
  ],
};

describe("insight matcher run()", () => {
  it("returns the validated answer", async () => {
    const result = await run(input, {
      model: mockModel({ matchIndex: 1, confidence: "high" }),
    });
    expect(result).toEqual({ matchIndex: 1, confidence: "high" });
  });

  it("throws for an off-schema response", async () => {
    await expect(
      run(input, {
        model: mockModel({ matchIndex: "one", confidence: "high" }),
      }),
    ).rejects.toThrow();
  });
});

describe("resolveMatch", () => {
  it("returns the 0-based index only for a high-confidence, in-range match", () => {
    expect(resolveMatch({ matchIndex: 2, confidence: "high" }, 3)).toBe(1);
  });

  it("returns null for low confidence", () => {
    expect(resolveMatch({ matchIndex: 1, confidence: "low" }, 3)).toBeNull();
  });

  it("returns null when the model says none", () => {
    expect(
      resolveMatch({ matchIndex: null, confidence: "high" }, 3),
    ).toBeNull();
  });

  it("returns null for an index outside the shortlist", () => {
    expect(resolveMatch({ matchIndex: 4, confidence: "high" }, 3)).toBeNull();
    expect(resolveMatch({ matchIndex: 0, confidence: "high" }, 3)).toBeNull();
    expect(resolveMatch({ matchIndex: -1, confidence: "high" }, 3)).toBeNull();
  });
});
