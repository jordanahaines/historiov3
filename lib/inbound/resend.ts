import { Resend } from "resend";

let client: Resend | null = null;

function resend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  client ??= new Resend(key);
  return client;
}

/**
 * Downloads one attachment of a received email. The webhook only carries
 * metadata; the file itself is behind a short-lived download URL.
 */
export async function downloadReceivedAttachment(
  emailId: string,
  attachmentId: string,
): Promise<Uint8Array> {
  const { data, error } = await resend().emails.receiving.attachments.get({
    emailId,
    id: attachmentId,
  });
  if (error || !data) {
    throw new Error(
      `Resend attachment lookup failed: ${error?.message ?? "no data"}`,
    );
  }
  const response = await fetch(data.download_url);
  if (!response.ok) {
    throw new Error(`Attachment download failed: HTTP ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}
