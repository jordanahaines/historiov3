import { FatalError } from "workflow";
import { start } from "workflow/api";

import {
  countHighlightsForEvent,
  listPendingHighlightIdsForEvent,
} from "@/lib/authz/highlights";
import { updateIngestionEvent } from "@/lib/authz/ingestion-events";
import {
  downloadPdfFromLink,
  downloadReceivedAttachment,
  getReceivedEmailBody,
} from "@/lib/inbound/resend";
import { pdfLinksOf } from "@/lib/inbound/pdf-links";
import type { PdfAttachment } from "@/lib/inbound/received-email";
import {
  buildTranscribeOptions,
  parseScribeNotebook,
  saveNewHighlights,
} from "@/lib/ingestion/kindle-scribe";
import {
  downloadIngestionAttachment,
  uploadIngestionAttachment,
} from "@/lib/storage/buckets";

import { processHighlightWorkflow } from "../process-highlight";

export type ImportSummary = {
  bookId: string;
  highlightsFound: number;
};

/**
 * Copies the email's notebook PDFs into private Storage and moves the event to
 * `processing`. The PDF is either a real attachment or, for Kindle's "You sent
 * a file" email, a download link in the body. Steps pass storage paths, never
 * file bytes: step inputs and outputs are persisted.
 */
export async function storeAttachments(input: {
  ingestionEventId: string;
  userId: string;
  resendEmailId: string;
  attachments: PdfAttachment[];
}): Promise<string[]> {
  "use step";

  const files: Uint8Array[] = [];
  for (const attachment of input.attachments) {
    files.push(
      await downloadReceivedAttachment(input.resendEmailId, attachment.id),
    );
  }

  if (files.length === 0) {
    const links = pdfLinksOf(await getReceivedEmailBody(input.resendEmailId));
    for (const link of links) {
      files.push(await downloadPdfFromLink(link));
    }
  }

  if (files.length === 0) {
    throw new FatalError(
      "The email has no PDF attachment or PDF download link",
    );
  }

  const paths: string[] = [];
  for (const [index, bytes] of files.entries()) {
    paths.push(
      await uploadIngestionAttachment(
        input.userId,
        input.ingestionEventId,
        index,
        bytes,
      ),
    );
  }

  await updateIngestionEvent(input.ingestionEventId, {
    status: "processing",
    attachmentPath: paths[0],
  });
  return paths;
}

/**
 * Parses one stored notebook, transcribes handwritten notes, and saves the
 * book, library entry and new highlights. Safe to retry: only highlights whose
 * dedup key is new are inserted.
 */
export async function importNotebook(input: {
  ingestionEventId: string;
  userId: string;
  attachmentPath: string;
}): Promise<ImportSummary> {
  "use step";

  const pdf = await downloadIngestionAttachment(input.attachmentPath);

  let parsed;
  try {
    parsed = parseScribeNotebook(pdf);
  } catch (error) {
    // A PDF that isn't a Scribe notebook won't parse on retry either.
    throw new FatalError(
      `Could not parse the PDF as a Kindle Scribe notebook: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const summary = await saveNewHighlights(parsed, {
    userId: input.userId,
    ingestionEventId: input.ingestionEventId,
    transcribeOptions: buildTranscribeOptions(),
  });
  return { bookId: summary.bookId, highlightsFound: summary.highlightsFound };
}

/**
 * Starts one processHighlightWorkflow per highlight from this import that is
 * still `pending`. Reading pending rows (rather than trusting the import
 * step's return value) keeps this correct if the import step was retried.
 */
export async function startHighlightWorkflows(
  ingestionEventId: string,
): Promise<number> {
  "use step";

  const ids = await listPendingHighlightIdsForEvent(ingestionEventId);
  for (const id of ids) {
    await start(processHighlightWorkflow, [id]);
  }
  return ids.length;
}

export async function completeIngestion(input: {
  ingestionEventId: string;
  summaries: ImportSummary[];
}): Promise<void> {
  "use step";

  const bookIds = [...new Set(input.summaries.map((s) => s.bookId))];
  await updateIngestionEvent(input.ingestionEventId, {
    status: "completed",
    bookId: bookIds.length === 1 ? bookIds[0] : null,
    highlightsFound: input.summaries.reduce(
      (sum, s) => sum + s.highlightsFound,
      0,
    ),
    highlightsNew: await countHighlightsForEvent(input.ingestionEventId),
    completedAt: new Date(),
  });
}

export async function failIngestion(input: {
  ingestionEventId: string;
  message: string;
}): Promise<void> {
  "use step";

  await updateIngestionEvent(input.ingestionEventId, {
    status: "failed",
    error: input.message.slice(0, 2000),
    completedAt: new Date(),
  });
}
