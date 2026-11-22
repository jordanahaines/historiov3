import { z } from "zod";

/** The subset of Resend's `email.received` event data we rely on. */
export const receivedEmailDataSchema = z.object({
  email_id: z.string().min(1),
  from: z.string().nullish(),
  to: z.array(z.string()).default([]),
  received_for: z.array(z.string()).default([]),
  subject: z.string().nullish(),
  attachments: z
    .array(
      z.object({
        id: z.string().min(1),
        filename: z.string().nullish(),
        content_type: z.string().nullish(),
      }),
    )
    .default([]),
});

export type ReceivedEmailData = z.infer<typeof receivedEmailDataSchema>;

export type PdfAttachment = { id: string; filename: string | null };

/** Only PDFs are notebooks; anything else on the email is ignored. */
export function pdfAttachmentsOf(data: ReceivedEmailData): PdfAttachment[] {
  return data.attachments
    .filter(
      (attachment) =>
        attachment.content_type?.toLowerCase() === "application/pdf" ||
        attachment.filename?.toLowerCase().endsWith(".pdf"),
    )
    .map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename ?? null,
    }));
}
