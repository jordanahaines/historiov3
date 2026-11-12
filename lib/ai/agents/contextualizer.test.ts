import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";

import { run } from "./contextualizer";

const baseInput = {
  bookTitle: "Weavers, Scribes, and Kings",
  bookAuthor: "Amanda H. Podany",
  highlightedText: "Shulgi's administrative reforms...",
  noteText: null,
};

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

describe("contextualizer run()", () => {
  it("returns a discard result for a mocked discard response", async () => {
    const model = mockModel({
      discard: true,
      discardReason: "No historical anchor",
      context: null,
    });

    const result = await run(baseInput, { model });

    expect(result).toEqual({
      discard: true,
      discardReason: "No historical anchor",
      context: null,
    });
  });

  it("returns a context result for a mocked keep response", async () => {
    const model = mockModel({
      discard: false,
      discardReason: null,
      context: "This describes King Shulgi's administrative reforms.",
    });

    const result = await run(baseInput, { model });

    expect(result).toEqual({
      discard: false,
      discardReason: null,
      context: "This describes King Shulgi's administrative reforms.",
    });
  });

  it("throws rather than returning a result for a malformed/off-schema response", async () => {
    // discard: true with no discardReason violates the schema's refinement.
    const model = mockModel({
      discard: true,
      discardReason: null,
      context: null,
    });

    await expect(run(baseInput, { model })).rejects.toThrow();
  });
});
