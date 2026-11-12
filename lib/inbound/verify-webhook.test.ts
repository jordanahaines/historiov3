import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyResendWebhook } from "./verify-webhook";

const SECRET_BYTES = Buffer.from("test-secret-bytes-0123456789abcdef");
const SECRET = `whsec_${SECRET_BYTES.toString("base64")}`;

function signedHeaders(body: string, overrides: Record<string, string> = {}) {
  const id = "msg_123";
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = createHmac("sha256", SECRET_BYTES)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return new Headers({
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${signature}`,
    ...overrides,
  });
}

const body = JSON.stringify({
  type: "email.received",
  created_at: new Date().toISOString(),
  data: { email_id: "e1" },
});

describe("verifyResendWebhook", () => {
  it("returns the event for a correctly signed body", () => {
    const event = verifyResendWebhook(body, signedHeaders(body), SECRET);
    expect(event).toEqual({ type: "email.received", data: { email_id: "e1" } });
  });

  it("returns null for a tampered body", () => {
    const headers = signedHeaders(body);
    expect(verifyResendWebhook(body + " ", headers, SECRET)).toBeNull();
  });

  it("returns null for a wrong secret", () => {
    const other = `whsec_${Buffer.from("different").toString("base64")}`;
    expect(verifyResendWebhook(body, signedHeaders(body), other)).toBeNull();
  });

  it("returns null when signature headers are missing", () => {
    expect(verifyResendWebhook(body, new Headers(), SECRET)).toBeNull();
  });
});
