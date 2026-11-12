/**
 * Re-runs the per-highlight pipeline for highlights stuck short of a terminal
 * status (`pending`, `contextualized`, or `failed`), in-process.
 *
 *   pnpm pipeline:resume [--user <profile-id>] [--concurrency N]
 */
import "dotenv/config";
import { parseArgs } from "node:util";

import { listResumableHighlightIds } from "@/lib/authz/highlights";

import { processHighlightsInline } from "./lib/process-inline.mjs";

async function main() {
  const { values } = parseArgs({
    options: {
      user: { type: "string" },
      concurrency: { type: "string", default: "4" },
    },
  });
  const ids = await listResumableHighlightIds(values.user);
  console.log(`${ids.length} highlight(s) to resume.`);
  await processHighlightsInline(ids, Number(values.concurrency));
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
