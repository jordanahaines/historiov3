import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";

import { buildInsightSynthesizerPrompt } from "@/lib/ai/prompts/insight-synthesizer";

import { run } from "./insight-synthesizer";

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
  title: "Titanic sinking",
  type: "event",
  contributions: ["The ship hit an iceberg.", "Over 1,500 people died."],
};

describe("insight synthesizer", () => {
  it("returns a non-empty description", async () => {
    const result = await run(input, {
      model: mockModel({ description: "The ship hit an iceberg; 1,500 died." }),
    });
    expect(result.description).toContain("iceberg");
  });

  it("rejects an empty description", async () => {
    await expect(
      run(input, { model: mockModel({ description: "  " }) }),
    ).rejects.toThrow();
  });

  it("puts every contribution in the prompt", () => {
    const prompt = buildInsightSynthesizerPrompt(input);
    for (const contribution of input.contributions) {
      expect(prompt).toContain(contribution);
    }
    expect(prompt).toContain("Titanic sinking");
  });
});
