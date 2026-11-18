import { describe, expect, it } from "vitest";
import { MockLanguageModelV4 } from "ai/test";

import * as eventResearcher from "./event-researcher";
import * as personResearcher from "./person-researcher";

const input = {
  bookTitle: "Weavers, Scribes, and Kings",
  bookAuthor: "Amanda H. Podany",
  highlightedText: "Shulgi's administrative reforms...",
  noteText: null,
  context: "This describes King Shulgi's reforms in Ur III.",
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

const candidate = (title: string, startsYear: number) => ({
  title,
  description: `About ${title}`,
  startsYear,
  startsMonth: null,
  startsDay: null,
  endsYear: null,
  endsMonth: null,
  endsDay: null,
  lat: null,
  lng: null,
});

describe.each([
  ["event researcher", eventResearcher],
  ["person researcher", personResearcher],
])("%s run()", (_name, agent) => {
  it("exports a version string and a schema", () => {
    expect(agent.version).toBe("v1");
    expect(agent.schema).toBeDefined();
  });

  it("returns validated candidates for a mocked response with 2 candidates", async () => {
    const response = {
      candidates: [candidate("First", -2094), candidate("Second", -2047)],
    };

    const result = await agent.run(input, { model: mockModel(response) });

    expect(result).toEqual(response);
  });

  it("returns an empty candidates array without error", async () => {
    const result = await agent.run(input, {
      model: mockModel({ candidates: [] }),
    });

    expect(result).toEqual({ candidates: [] });
  });

  it("throws for a schema-invalid response (missing startsYear)", async () => {
    const withoutYear: Partial<ReturnType<typeof candidate>> = candidate(
      "Bad",
      0,
    );
    delete withoutYear.startsYear;
    const model = mockModel({ candidates: [withoutYear] });

    await expect(agent.run(input, { model })).rejects.toThrow();
  });

  it("throws for a response that isn't the expected object", async () => {
    await expect(
      agent.run(input, { model: mockModel({ candidates: "nope" }) }),
    ).rejects.toThrow();
  });

  it.each([
    ["month 13", { startsMonth: 13 }],
    ["month 0", { startsMonth: 0 }],
    ["day 32", { startsDay: 32 }],
    ["day 0", { endsDay: 0 }],
    ["lat 91", { lat: 91 }],
    ["lat -91", { lat: -91 }],
    ["lng 181", { lng: 181 }],
    ["lng -181", { lng: -181 }],
  ])("rejects out-of-range %s", async (_label, override) => {
    const model = mockModel({
      candidates: [{ ...candidate("Bad", 0), ...override }],
    });

    await expect(agent.run(input, { model })).rejects.toThrow();
  });

  it("accepts boundary values", async () => {
    const response = {
      candidates: [
        {
          ...candidate("Edge", 0),
          startsMonth: 1,
          startsDay: 31,
          endsMonth: 12,
          endsDay: 1,
          lat: -90,
          lng: 180,
        },
      ],
    };

    await expect(
      agent.run(input, { model: mockModel(response) }),
    ).resolves.toEqual(response);
  });
});
