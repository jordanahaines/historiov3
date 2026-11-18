import { FatalError } from "workflow";

import * as insightMatcher from "@/lib/ai/agents/insight-matcher";
import * as insightSynthesizer from "@/lib/ai/agents/insight-synthesizer";
import {
  getInsightMatcherModel,
  getInsightSynthesizerModel,
} from "@/lib/ai/model-config";
import type { TypedCandidate } from "@/lib/insights/candidate";
import {
  mergeCandidatesForHighlight,
  type MergeOutcome,
} from "@/lib/insights/merge-candidates";

/**
 * Persists a highlight's candidates as insights (create or enrich) and marks
 * it `researched`, atomically. Call even with zero candidates so the highlight
 * reaches its terminal status.
 */
export async function mergeHighlightInsights(
  highlightId: string,
  candidates: TypedCandidate[],
): Promise<MergeOutcome> {
  "use step";

  try {
    return await mergeCandidatesForHighlight(highlightId, candidates, {
      judge: (input) =>
        insightMatcher.run(input, { model: getInsightMatcherModel() }),
      synthesize: (input) =>
        insightSynthesizer.run(input, { model: getInsightSynthesizerModel() }),
    });
  } catch (error) {
    if (error instanceof Error && /not found/.test(error.message)) {
      throw new FatalError(error.message);
    }
    throw error;
  }
}
