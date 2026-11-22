import { describe, expect, it } from "vitest";
import { start } from "workflow/api";
import { getWorld } from "workflow/runtime";

import {
  happyIngestWorkflow,
  noPdfIngestWorkflow,
} from "./__fixtures__/ingest-email-fixtures";
import {
  discardedHighlightWorkflow,
  failingHighlightWorkflow,
  keptHighlightWorkflow,
} from "./__fixtures__/process-highlight-fixtures";

// Step names are recorded as `step//<module>//<function>`; match on the
// function name.
async function stepNames(runId: string): Promise<string[]> {
  const world = await getWorld();
  const { data } = await world.steps.list({ runId });
  return data.map((step) => step.stepName.split("//").at(-1) ?? step.stepName);
}

describe("per-highlight workflow orchestration", () => {
  it("runs both researchers and one merge for a kept highlight", async () => {
    const run = await start(keptHighlightWorkflow, ["h-kept"]);

    await expect(run.returnValue).resolves.toMatchObject({
      highlightId: "h-kept",
      discarded: false,
      outcome: { created: 2 },
    });
    await expect(run.status).resolves.toBe("completed");
    expect((await stepNames(run.runId)).sort()).toEqual([
      "keep",
      "mergeHighlightInsights",
      "runEventResearcher",
      "runPersonResearcher",
    ]);
  });

  it("skips researchers and merge for a discarded highlight", async () => {
    const run = await start(discardedHighlightWorkflow, ["h-discarded"]);

    await expect(run.returnValue).resolves.toEqual({
      highlightId: "h-discarded",
      discarded: true,
      outcome: null,
    });
    expect(await stepNames(run.runId)).toEqual(["discard"]);
  });

  it("runs the failure step and fails the run when a step is fatal", async () => {
    const run = await start(failingHighlightWorkflow, ["h-bad"]);

    await expect(run.returnValue).rejects.toThrow();
    await expect(run.status).resolves.toBe("failed");
    expect(await stepNames(run.runId)).toEqual(
      expect.arrayContaining(["explode", "failHighlight"]),
    );
  });
});

describe("email ingest workflow orchestration", () => {
  it("stores, imports, starts highlight workflows, then completes", async () => {
    const run = await start(happyIngestWorkflow, ["ev-1"]);

    await expect(run.returnValue).resolves.toEqual({
      ingestionEventId: "ev-1",
      highlightWorkflowsStarted: 4,
    });
    expect((await stepNames(run.runId)).sort()).toEqual([
      "completeIngestion",
      "importNotebook",
      "startHighlightWorkflows",
      "storeAttachments",
    ]);
  });

  it("marks the event failed and fails the run when the email has no PDF", async () => {
    const run = await start(noPdfIngestWorkflow, ["ev-2"]);

    await expect(run.returnValue).rejects.toThrow();
    const names = await stepNames(run.runId);
    expect(names).toContain("failIngestion");
    expect(names).not.toContain("importNotebook");
  });
});
