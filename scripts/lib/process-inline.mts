import {
  defaultSteps,
  orchestrateHighlight,
} from "@/lib/workflows/process-highlight";

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

  async function worker() {
    while (next < ids.length) {
      const id = ids[next++];
      try {
        const result = await orchestrateHighlight(id, defaultSteps);
        const detail = result.discarded
          ? "discarded"
          : `created ${result.outcome?.created}, enriched ${result.outcome?.enriched}`;
        finished += 1;
        console.log(`[${finished + failed}/${ids.length}] ${id}: ${detail}`);
      } catch (error) {
        failed += 1;
        console.error(
          `[${finished + failed}/${ids.length}] ${id}: FAILED`,
          error,
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, ids.length) }, worker),
  );
  console.log(`Processed ${ids.length}: ${finished} ok, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}
