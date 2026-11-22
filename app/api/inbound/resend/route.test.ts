import { beforeEach, describe, expect, it, vi } from "vitest";

const verifyResendWebhook = vi.fn();
const handleInboundEmail = vi.fn();
const start = vi.fn();

vi.mock("@/lib/inbound/verify-webhook", () => ({ verifyResendWebhook }));
vi.mock("@/lib/inbound/handle-inbound-email", () => ({ handleInboundEmail }));
vi.mock("workflow/api", () => ({ start }));
vi.mock("@/lib/authz/ingestion-events", () => ({
  createIngestionEventIfNew: vi.fn(),
  deleteIngestionEvent: vi.fn(),
}));
vi.mock("@/lib/authz/profiles", () => ({ getProfileByInboundToken: vi.fn() }));
vi.mock("@/lib/workflows/ingest-email", () => ({ ingestEmailWorkflow: {} }));

const { POST } = await import("./route");

function request(body = "{}") {
  return new Request("http://localhost/api/inbound/resend", {
    method: "POST",
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_WEBHOOK_SECRET = "whsec_x";
  process.env.INBOUND_EMAIL_DOMAIN = "ioestiogra.resend.app";
});

describe("POST /api/inbound/resend", () => {
  it("returns 401 and does no work when the signature does not verify", async () => {
    verifyResendWebhook.mockReturnValue(null);
    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(handleInboundEmail).not.toHaveBeenCalled();
  });

  it("acknowledges and ignores other event types", async () => {
    verifyResendWebhook.mockReturnValue({ type: "email.delivered", data: {} });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(handleInboundEmail).not.toHaveBeenCalled();
  });

  it("passes email.received data to the handler and returns 200", async () => {
    verifyResendWebhook.mockReturnValue({
      type: "email.received",
      data: { email_id: "e1" },
    });
    handleInboundEmail.mockResolvedValue({
      outcome: "started",
      ingestionEventId: "ev1",
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(handleInboundEmail).toHaveBeenCalledWith(
      { email_id: "e1" },
      expect.objectContaining({ inboundDomain: "ioestiogra.resend.app" }),
    );
  });

  it("returns 200 for unroutable mail so Resend does not retry", async () => {
    verifyResendWebhook.mockReturnValue({ type: "email.received", data: {} });
    handleInboundEmail.mockResolvedValue({
      outcome: "ignored",
      reason: "no recipient matched a user",
    });
    expect((await POST(request())).status).toBe(200);
  });

  it("returns 500 when the server is not configured", async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    expect((await POST(request())).status).toBe(500);
  });
});
