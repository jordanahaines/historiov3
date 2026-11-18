/**
 * Imports a local Kindle Scribe notebook PDF for a user through the same code
 * path as the inbound email (no Resend needed), then runs the per-highlight
 * pipeline inline.
 *
 *   pnpm ingest:pdf <file.pdf> --user <profile-id> [--no-process] [--concurrency N]
 *
 * Parses and saves in-process (the same functions the importNotebook step
 * calls), logging each stage with elapsed time. Workflow step functions are
 * plain async functions outside the workflow runtime, so the pipeline runs
 * directly too.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { getTranscriptionModel } from "@/lib/ai/model-config";
import { listPendingHighlightIdsForEvent } from "@/lib/authz/highlights";
import {
  createManualIngestionEvent,
  updateIngestionEvent,
} from "@/lib/authz/ingestion-events";
import { getProfileById } from "@/lib/authz/profiles";
import {
  buildTranscribeOptions,
  parseScribeNotebook,
  saveNewHighlights,
} from "@/lib/ingestion/kindle-scribe";
import { uploadIngestionAttachment } from "@/lib/storage/buckets";
import {
  completeIngestion,
  failIngestion,
} from "@/lib/workflows/steps/ingest-steps";

import { log } from "./lib/log.mjs";
import { processHighlightsInline } from "./lib/process-inline.mjs";

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      user: { type: "string" },
      "no-process": { type: "boolean", default: false },
      concurrency: { type: "string", default: "4" },
    },
  });
  const file = positionals[0];
  if (!file || !values.user) {
    throw new Error(
      "Usage: pnpm ingest:pdf <file.pdf> --user <profile-id> [--no-process] [--concurrency N]",
    );
  }

  log(`Looking up profile ${values.user}…`);
  const profile = await getProfileById(values.user);
  if (!profile) throw new Error(`No v3 profile with id ${values.user}`);
  log("Profile found.");

  const bytes = new Uint8Array(await readFile(file));
  log(`Read ${file} (${(bytes.byteLength / 1024 / 1024).toFixed(2)} MB)`);
  const event = await createManualIngestionEvent(profile.id, `CLI: ${file}`);
  log(`Ingestion event ${event.id}`);

  try {
    log("Uploading PDF to storage…");
    const attachmentPath = await uploadIngestionAttachment(
      profile.id,
      event.id,
      0,
      bytes,
    );
    await updateIngestionEvent(event.id, {
      status: "processing",
      attachmentPath,
    });
    log(`Stored at ${attachmentPath}`);

    log("Parsing notebook…");
    const parsed = parseScribeNotebook(bytes);
    const handwritten = parsed.highlights.filter(
      (h) => h.note?.type === "handwritten",
    ).length;
    const typed = parsed.highlights.filter(
      (h) => h.note?.type === "typed",
    ).length;
    log(
      `Book: "${parsed.book.title}" by ${parsed.book.author ?? "unknown"} (ASIN ${parsed.book.asin})`,
    );
    log(
      `Parsed ${parsed.highlights.length} highlight(s): ${typed} with typed notes, ${handwritten} with handwritten notes.`,
    );

    log("Saving highlights (transcribing new handwritten notes)…");
    const summary = await saveNewHighlights(parsed, {
      userId: profile.id,
      ingestionEventId: event.id,
      transcribeOptions: buildTranscribeOptions((e) => {
        if (e.phase === "start") {
          log(
            `Transcription: started ${e.count} note(s) with ${getTranscriptionModel()}`,
          );
        } else {
          log(`Transcription: done ${e.count} note(s)`);
        }
      }),
    });
    log(
      `${summary.bookCreated ? "Added new book to the catalog" : "Book already in the catalog"}; ` +
        `${summary.highlightsSaved} new highlight(s) saved, ` +
        `${summary.highlightsSkippedAsDuplicate} skipped as duplicates.`,
    );

    await completeIngestion({
      ingestionEventId: event.id,
      summaries: [
        { bookId: summary.bookId, highlightsFound: summary.highlightsFound },
      ],
    });
    const pending = await listPendingHighlightIdsForEvent(event.id);
    log(`Import complete: ${pending.length} highlight(s) awaiting processing.`);
    if (values["no-process"]) {
      log("--no-process set; skipping the insight pipeline.");
    } else {
      await processHighlightsInline(pending, Number(values.concurrency));
    }
  } catch (error) {
    log("FAILED — marking the ingestion event failed.");
    await failIngestion({
      ingestionEventId: event.id,
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
