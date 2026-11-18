import {
  defaultSteps,
  orchestrateHighlight,
  type HighlightSteps,
} from "@/lib/workflows/process-highlight";

import { log, logError } from "./log.mjs";

/** Wraps the pipeline steps so each stage of a highlight is logged. */
function withLogging(steps: HighlightSteps, tag: string): HighlightSteps {
  return {
    contextualize: async (id) => {
      log(`${tag} contextualizing…`);
      const result = await steps.contextualize(id);
      log(
        `${tag} ${result.discarded ? "discarded (not groundable)" : "contextualized"}`,
      );
      return result;
    },
    researchers: {
      event: async (id) => {
        const found = await steps.researchers.event(id);
        log(`${tag} event researcher: ${found.length} candidate(s)`);
        return found;
      },
      person: async (id) => {
        const found = await steps.researchers.person(id);
        log(`${tag} person researcher: ${found.length} candidate(s)`);
        return found;
      },
    },
    merge: async (id, candidates) => {
      log(`${tag} merging ${candidates.length} candidate(s) into insights…`);
      return steps.merge(id, candidates);
    },
    fail: steps.fail,
  };
}

/**
 * Runs the per-highlight pipeline in-process with bounded concurrency. In
 * production each highlight is its own parallel workflow run; concurrency here
 * mimics that (and exercises the per-user insight lock).
 */
export async function processHighlightsInline(
  ids: string[],
  concurrency = 4,
): Promise<void> {
  let next = 0;
  let finished = 0;
  let failed = 0;
  let created = 0;
  let enriched = 0;
  let discarded = 0;

  const workers = Math.min(concurrency, ids.length);
  log(`Processing ${ids.length} highlight(s), ${workers} at a time.`);

  async function worker() {
    while (next < ids.length) {
      const id = ids[next++];
      const tag = `[${id.slice(0, 8)}]`;
      try {
        const result = await orchestrateHighlight(
          id,
          withLogging(defaultSteps, tag),
        );
        const detail = result.discarded
          ? "discarded"
          : `created ${result.outcome?.created}, enriched ${result.outcome?.enriched}`;
        if (result.discarded) discarded += 1;
        created += result.outcome?.created ?? 0;
        enriched += result.outcome?.enriched ?? 0;
        finished += 1;
        log(`(${finished + failed}/${ids.length}) ${tag} done: ${detail}`);
      } catch (error) {
        failed += 1;
        logError(`(${finished + failed}/${ids.length}) ${tag} FAILED`, error);
      }
    }
  }

  await Promise.all(Array.from({ length: workers }, worker));
  log(
    `Processed ${ids.length}: ${finished} ok (${discarded} discarded), ${failed} failed. Insights: ${created} created, ${enriched} enriched.`,
  );
  if (failed > 0) process.exitCode = 1;
}
