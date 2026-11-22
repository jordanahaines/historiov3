import { markHighlightFailed } from "@/lib/authz/highlights";

/** Terminal bookkeeping when a highlight's workflow has exhausted its retries. */
export async function failHighlight(
  highlightId: string,
  reason: string,
): Promise<void> {
  "use step";

  console.error(`Highlight ${highlightId} failed: ${reason}`);
  await markHighlightFailed(highlightId);
}
