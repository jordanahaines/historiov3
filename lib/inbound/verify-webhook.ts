import { Resend } from "resend";

export type VerifiedEvent = { type: string; data: unknown };

/**
 * Verifies a Resend webhook against the *raw* body and returns the event, or
 * null when the signature doesn't verify. Resend signs with Svix; the header
 * names are `svix-*` (older `webhook-*` accepted too).
 */
export function verifyResendWebhook(
  rawBody: string,
  headers: Headers,
  secret: string,
): VerifiedEvent | null {
  const id = headers.get("svix-id") ?? headers.get("webhook-id");
  const timestamp =
    headers.get("svix-timestamp") ?? headers.get("webhook-timestamp");
  const signature =
    headers.get("svix-signature") ?? headers.get("webhook-signature");
  if (!id || !timestamp || !signature) return null;

  try {
    // The key isn't used for verification, only to construct the client.
    const event = new Resend("re_unused").webhooks.verify({
      payload: rawBody,
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    });
    return { type: event.type, data: event.data };
  } catch {
    return null;
  }
}
