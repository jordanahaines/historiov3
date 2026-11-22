import { describe, expect, it, vi } from "vitest";

import type { IngestionEvent } from "@/lib/authz/ingestion-events";

import { handleInboundEmail, type InboundDeps } from "./handle-inbound-email";

const DOMAIN = "ioestiogra.resend.app";

function makeDeps(overrides: Partial<InboundDeps> = {}) {
  const deps: InboundDeps = {
    inboundDomain: DOMAIN,
    getProfileByInboundToken: vi.fn(async (token: string) =>
      token === "good" ? { id: "user-1" } : null,
    ),
    createIngestionEventIfNew: vi.fn(async () => ({
      event: { id: "event-1" } as IngestionEvent,
      created: true,
    })),
    startIngestWorkflow: vi.fn(async () => {}),
    deleteIngestionEvent: vi.fn(async () => {}),
    ...overrides,
  };
  return deps;
}

const emailData = {
  email_id: "email-1",
  from: "me@example.com",
  to: [`good@${DOMAIN}`],
  subject: "Notebook",
  attachments: [
    { id: "a1", filename: "book.pdf", content_type: "application/pdf" },
    { id: "a2", filename: "logo.png", content_type: "image/png" },
  ],
};

describe("handleInboundEmail", () => {
  it("records the email and starts the workflow with only PDF attachments", async () => {
    const deps = makeDeps();
    const result = await handleInboundEmail(emailData, deps);

    expect(result).toEqual({ outcome: "started", ingestionEventId: "event-1" });
    expect(deps.createIngestionEventIfNew).toHaveBeenCalledWith({
      userId: "user-1",
      resendEmailId: "email-1",
      fromAddress: "me@example.com",
      subject: "Notebook",
    });
    expect(deps.startIngestWorkflow).toHaveBeenCalledWith({
      ingestionEventId: "event-1",
      userId: "user-1",
      resendEmailId: "email-1",
      attachments: [{ id: "a1", filename: "book.pdf" }],
    });
  });

  it("is a silent no-op when the token matches no user", async () => {
    const deps = makeDeps();
    const result = await handleInboundEmail(
      { ...emailData, to: [`unknown@${DOMAIN}`] },
      deps,
    );
    expect(result.outcome).toBe("ignored");
    expect(deps.createIngestionEventIfNew).not.toHaveBeenCalled();
    expect(deps.startIngestWorkflow).not.toHaveBeenCalled();
  });

  it("ignores mail addressed to other domains", async () => {
    const deps = makeDeps();
    const result = await handleInboundEmail(
      { ...emailData, to: ["good@elsewhere.com"] },
      deps,
    );
    expect(result.outcome).toBe("ignored");
    expect(deps.getProfileByInboundToken).not.toHaveBeenCalled();
  });

  it("does not start a second workflow for a redelivered email", async () => {
    const deps = makeDeps({
      createIngestionEventIfNew: vi.fn(async () => ({
        event: { id: "event-1" } as IngestionEvent,
        created: false,
      })),
    });
    const result = await handleInboundEmail(emailData, deps);
    expect(result).toEqual({
      outcome: "duplicate",
      ingestionEventId: "event-1",
    });
    expect(deps.startIngestWorkflow).not.toHaveBeenCalled();
  });

  it("still starts the workflow for an email with no PDF (it fails there, visibly)", async () => {
    const deps = makeDeps();
    await handleInboundEmail({ ...emailData, attachments: [] }, deps);
    expect(deps.startIngestWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: [] }),
    );
  });

  it("removes the event row and rethrows when the workflow fails to start, so a retry is not a 'duplicate'", async () => {
    const deps = makeDeps({
      startIngestWorkflow: vi.fn(async () => {
        throw new Error("queue down");
      }),
    });
    await expect(handleInboundEmail(emailData, deps)).rejects.toThrow(
      "queue down",
    );
    expect(deps.deleteIngestionEvent).toHaveBeenCalledWith("event-1");
  });

  it("ignores malformed event data without throwing", async () => {
    const deps = makeDeps();
    expect(await handleInboundEmail({ nope: true }, deps)).toEqual({
      outcome: "ignored",
      reason: "malformed event data",
    });
  });

  it("derives identity only from the recipient token, never the payload", async () => {
    const deps = makeDeps();
    await handleInboundEmail(
      { ...emailData, user_id: "attacker", userId: "attacker" },
      deps,
    );
    expect(deps.createIngestionEventIfNew).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
    );
  });
});
