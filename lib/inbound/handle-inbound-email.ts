import type { IngestionEvent } from "@/lib/authz/ingestion-events";
import type { ProfileRef } from "@/lib/authz/profiles";
import { extractInboundTokens } from "@/lib/inbound/recipients";
import {
  pdfAttachmentsOf,
  receivedEmailDataSchema,
  type PdfAttachment,
} from "@/lib/inbound/received-email";

export type IngestEmailInput = {
  ingestionEventId: string;
  userId: string;
  resendEmailId: string;
  attachments: PdfAttachment[];
};

export type InboundDeps = {
  inboundDomain: string;
  getProfileByInboundToken: (token: string) => Promise<ProfileRef | null>;
  createIngestionEventIfNew: (input: {
    userId: string;
    resendEmailId: string;
    fromAddress: string | null;
    subject: string | null;
  }) => Promise<{ event: IngestionEvent; created: boolean }>;
  startIngestWorkflow: (input: IngestEmailInput) => Promise<void>;
  /** Undo for a failed workflow start (see handleInboundEmail). */
  deleteIngestionEvent: (id: string) => Promise<void>;
};

export type InboundResult =
  | { outcome: "ignored"; reason: string }
  | { outcome: "duplicate"; ingestionEventId: string }
  | { outcome: "started"; ingestionEventId: string };

/**
 * Handles one verified `email.received` event: resolve the user from the
 * recipient token (the only source of identity — never the payload), record the
 * email once, and start the import workflow. Never throws for unroutable mail:
 * the caller answers 200 so Resend doesn't retry something that can't succeed.
 * A failure to start the workflow does throw (after undoing the event row) so
 * Resend retries it.
 */
export async function handleInboundEmail(
  rawData: unknown,
  deps: InboundDeps,
): Promise<InboundResult> {
  const parsed = receivedEmailDataSchema.safeParse(rawData);
  if (!parsed.success) {
    return { outcome: "ignored", reason: "malformed event data" };
  }
  const data = parsed.data;

  const tokens = extractInboundTokens(
    [...data.to, ...data.received_for],
    deps.inboundDomain,
  );
  for (const token of tokens) {
    const profile = await deps.getProfileByInboundToken(token);
    if (!profile) continue;

    const { event, created } = await deps.createIngestionEventIfNew({
      userId: profile.id,
      resendEmailId: data.email_id,
      fromAddress: data.from ?? null,
      subject: data.subject ?? null,
    });
    if (!created) {
      return { outcome: "duplicate", ingestionEventId: event.id };
    }

    try {
      await deps.startIngestWorkflow({
        ingestionEventId: event.id,
        userId: profile.id,
        resendEmailId: data.email_id,
        attachments: pdfAttachmentsOf(data),
      });
    } catch (error) {
      // The row exists but nothing is processing it. Remove it so Resend's
      // retry of this delivery is treated as new instead of as a duplicate
      // that would silently never run, then let the error surface (500).
      await deps.deleteIngestionEvent(event.id);
      throw error;
    }
    return { outcome: "started", ingestionEventId: event.id };
  }

  return { outcome: "ignored", reason: "no recipient matched a user" };
}
