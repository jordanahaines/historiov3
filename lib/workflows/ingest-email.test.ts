import { describe, expect, it, vi } from "vitest";

// The default steps import the DB client, which needs DATABASE_URL at import
// time; these tests inject fake steps and never touch it.
vi.mock("@/lib/db", () => ({ db: {} }));

import { orchestrateIngest, type IngestSteps } from "./ingest-email";

const input = {
  ingestionEventId: "ev1",
  userId: "u1",
  resendEmailId: "re1",
  attachments: [{ id: "a1", filename: "b.pdf" }],
};

function makeSteps(overrides: Partial<IngestSteps> = {}): IngestSteps {
  return {
    storeAttachments: vi.fn(async () => ["u1/ev1/0.pdf"]),
    importNotebook: vi.fn(async () => ({ bookId: "b1", highlightsFound: 3 })),
    startHighlightWorkflows: vi.fn(async () => 3),
    completeIngestion: vi.fn(async () => {}),
    failIngestion: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("orchestrateIngest", () => {
  it("imports each stored PDF, starts highlight workflows, then completes", async () => {
    const steps = makeSteps({
      storeAttachments: vi.fn(async () => ["p0", "p1"]),
    });
    const result = await orchestrateIngest(input, steps);

    expect(steps.importNotebook).toHaveBeenCalledTimes(2);
    expect(steps.startHighlightWorkflows).toHaveBeenCalledWith("ev1");
    expect(steps.completeIngestion).toHaveBeenCalledWith({
      ingestionEventId: "ev1",
      summaries: [
        { bookId: "b1", highlightsFound: 3 },
        { bookId: "b1", highlightsFound: 3 },
      ],
    });
    expect(steps.failIngestion).not.toHaveBeenCalled();
    expect(result).toEqual({
      ingestionEventId: "ev1",
      highlightWorkflowsStarted: 3,
    });
  });

  it("marks the event failed with a readable message and starts nothing when import fails", async () => {
    const steps = makeSteps({
      importNotebook: vi.fn(async () => {
        throw new Error("Could not parse the PDF");
      }),
    });
    await expect(orchestrateIngest(input, steps)).rejects.toThrow("parse");
    expect(steps.failIngestion).toHaveBeenCalledWith({
      ingestionEventId: "ev1",
      message: "Could not parse the PDF",
    });
    expect(steps.startHighlightWorkflows).not.toHaveBeenCalled();
    expect(steps.completeIngestion).not.toHaveBeenCalled();
  });

  it("fails the event when the email has no PDF", async () => {
    const steps = makeSteps({
      storeAttachments: vi.fn(async () => {
        throw new Error("The email has no PDF attachment");
      }),
    });
    await expect(
      orchestrateIngest({ ...input, attachments: [] }, steps),
    ).rejects.toThrow();
    expect(steps.failIngestion).toHaveBeenCalledWith(
      expect.objectContaining({ message: "The email has no PDF attachment" }),
    );
  });
});
