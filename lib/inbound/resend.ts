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

/** Fetches the body of a received email (the webhook only carries metadata). */
export async function getReceivedEmailBody(
  emailId: string,
): Promise<{ html: string | null; text: string | null }> {
  const { data, error } = await resend().emails.receiving.get(emailId);
  if (error || !data) {
    throw new Error(
      `Resend email lookup failed: ${error?.message ?? "no data"}`,
    );
  }
  return { html: data.html, text: data.text };
}

const MAX_PDF_BYTES = 100 * 1024 * 1024;

/**
 * Downloads a PDF from a link in an email. Callers must pass URLs already
 * vetted by `pdfLinksOf` (https, allowed hosts); redirects are not followed so
 * a vetted host can't bounce us elsewhere.
 */
export async function downloadPdfFromLink(url: string): Promise<Uint8Array> {
  const response = await fetch(url, { redirect: "error" });
  if (!response.ok) {
    throw new Error(`PDF link download failed: HTTP ${response.status}`);
  }
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_PDF_BYTES) {
    throw new Error(`PDF link is too large (${declared} bytes)`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_PDF_BYTES) {
    throw new Error(`PDF link is too large (${bytes.byteLength} bytes)`);
  }
  const magic = new TextDecoder().decode(bytes.subarray(0, 5));
  if (magic !== "%PDF-") {
    // Expired pre-signed links return an XML/HTML error page with a 4xx; a
    // 200 that isn't a PDF won't become one on retry.
    throw new Error("PDF link did not return a PDF");
  }
  return bytes;
}
