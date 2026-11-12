import { start } from "workflow/api";

import {
  createIngestionEventIfNew,
  deleteIngestionEvent,
} from "@/lib/authz/ingestion-events";
import { getProfileByInboundToken } from "@/lib/authz/profiles";
import { handleInboundEmail } from "@/lib/inbound/handle-inbound-email";
import { verifyResendWebhook } from "@/lib/inbound/verify-webhook";
import { ingestEmailWorkflow } from "@/lib/workflows/ingest-email";

/**
 * Resend `email.received` webhook. Verifies the signature against the raw body
 * before doing anything else, records the email, starts the import workflow,
 * and returns immediately — processing happens in the workflow.
 */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const domain = process.env.INBOUND_EMAIL_DOMAIN;
  if (!secret || !domain) {
    console.error("RESEND_WEBHOOK_SECRET / INBOUND_EMAIL_DOMAIN not set");
    return new Response("Server misconfigured", { status: 500 });
  }

  const rawBody = await request.text();
  const event = verifyResendWebhook(rawBody, request.headers, secret);
  if (!event) return new Response("Invalid signature", { status: 401 });

  // Other event types can share the endpoint; acknowledge and ignore them.
  if (event.type !== "email.received") return Response.json({ ok: true });

  const result = await handleInboundEmail(event.data, {
    inboundDomain: domain,
    getProfileByInboundToken,
    createIngestionEventIfNew,
    deleteIngestionEvent,
    startIngestWorkflow: async (input) => {
      await start(ingestEmailWorkflow, [input]);
    },
  });

  if (result.outcome === "ignored") {
    console.warn(`Inbound email ignored: ${result.reason}`);
  }
  return Response.json({ ok: true, outcome: result.outcome });
}
