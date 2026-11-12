import { describe, expect, it, vi } from "vitest";

// The default steps import the DB client, which needs DATABASE_URL at import
// time; these tests inject fake steps and never touch it.
vi.mock("@/lib/db", () => ({ db: {} }));

import type { TypedCandidate } from "@/lib/insights/candidate";

import { orchestrateHighlight, type HighlightSteps } from "./process-highlight";

const candidate = (
  type: "event" | "person",
  title: string,
): TypedCandidate => ({
  type,
  title,
  description: null,
  startsYear: 1900,
  startsMonth: null,
  startsDay: null,
  endsYear: null,
  endsMonth: null,
  endsDay: null,
  lat: null,
  lng: null,
});

function makeSteps(overrides: Partial<HighlightSteps> = {}): HighlightSteps {
  return {
    contextualize: vi.fn(async () => ({ discarded: false })),
    researchers: {
      event: vi.fn(async () => [candidate("event", "E")]),
      person: vi.fn(async () => [candidate("person", "P")]),
    },
    merge: vi.fn(async () => ({
      skipped: false,
      created: 2,
      enriched: 0,
      alreadyLinked: 0,
    })),
    fail: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("orchestrateHighlight", () => {
  it("merges both researchers' candidates for a kept highlight", async () => {
    const steps = makeSteps();
    const result = await orchestrateHighlight("h1", steps);

    expect(steps.researchers.event).toHaveBeenCalledTimes(1);
    expect(steps.researchers.person).toHaveBeenCalledTimes(1);
    expect(steps.merge).toHaveBeenCalledWith("h1", [
      expect.objectContaining({ title: "E" }),
      expect.objectContaining({ title: "P" }),
    ]);
    expect(result).toMatchObject({ discarded: false, outcome: { created: 2 } });
  });

  it("stops after the Contextualizer for a discarded highlight", async () => {
    const steps = makeSteps({
      contextualize: vi.fn(async () => ({ discarded: true })),
    });
    const result = await orchestrateHighlight("h1", steps);

    expect(steps.researchers.event).not.toHaveBeenCalled();
    expect(steps.merge).not.toHaveBeenCalled();
    expect(result).toEqual({
      highlightId: "h1",
      discarded: true,
      outcome: null,
    });
  });

  it("still merges when the researchers return nothing, so the highlight finishes", async () => {
    const steps = makeSteps({
      researchers: {
        event: vi.fn(async () => []),
        person: vi.fn(async () => []),
      },
    });
    await orchestrateHighlight("h1", steps);
    expect(steps.merge).toHaveBeenCalledWith("h1", []);
  });

  it("marks the highlight failed and rethrows when a step fails", async () => {
    const steps = makeSteps({
      merge: vi.fn(async () => {
        throw new Error("boom");
      }),
    });
    await expect(orchestrateHighlight("h1", steps)).rejects.toThrow("boom");
    expect(steps.fail).toHaveBeenCalledWith("h1", "boom");
  });
});
