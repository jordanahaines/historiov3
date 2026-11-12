/**
 * Imports a local Kindle Scribe notebook PDF for a user through the same code
 * path as the inbound email (no Resend needed), then runs the per-highlight
 * pipeline inline.
 *
 *   pnpm ingest:pdf <file.pdf> --user <profile-id> [--no-process] [--concurrency N]
 *
 * Workflow step functions are plain async functions outside the workflow
 * runtime, so this runs them directly in-process.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { parseArgs } from "node:util";

import { listPendingHighlightIdsForEvent } from "@/lib/authz/highlights";
import {
  createManualIngestionEvent,
  updateIngestionEvent,
} from "@/lib/authz/ingestion-events";
import { getProfileById } from "@/lib/authz/profiles";
import { uploadIngestionAttachment } from "@/lib/storage/buckets";
import {
  completeIngestion,
  failIngestion,
  importNotebook,
} from "@/lib/workflows/steps/ingest-steps";

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

  const profile = await getProfileById(values.user);
  if (!profile) throw new Error(`No v3 profile with id ${values.user}`);

  const bytes = new Uint8Array(await readFile(file));
  const event = await createManualIngestionEvent(profile.id, `CLI: ${file}`);
  console.log(`Ingestion event ${event.id}`);

  try {
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
    const summary = await importNotebook({
      ingestionEventId: event.id,
      userId: profile.id,
      attachmentPath,
    });
    await completeIngestion({
      ingestionEventId: event.id,
      summaries: [summary],
    });
    const pending = await listPendingHighlightIdsForEvent(event.id);
    console.log(
      `Found ${summary.highlightsFound} highlights; ${pending.length} new.`,
    );
    if (!values["no-process"])
      await processHighlightsInline(pending, Number(values.concurrency));
  } catch (error) {
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
