import type { TypedCandidate } from "@/lib/insights/candidate";
import type { MergeOutcome } from "@/lib/insights/merge-candidates";

import {
  contextualizeHighlight,
  type ContextualizeHighlightResult,
} from "./steps/contextualize-highlight";
import { failHighlight } from "./steps/mark-highlight-failed";
import { mergeHighlightInsights } from "./steps/merge-highlight-insights";
import { runEventResearcher } from "./steps/run-event-researcher";
import { runPersonResearcher } from "./steps/run-person-researcher";

export type ProcessHighlightResult = {
  highlightId: string;
  discarded: boolean;
  outcome: MergeOutcome | null;
};

export type HighlightSteps = {
  contextualize: (id: string) => Promise<ContextualizeHighlightResult>;
  researchers: {
    event: (id: string) => Promise<TypedCandidate[]>;
    person: (id: string) => Promise<TypedCandidate[]>;
  };
  merge: (id: string, candidates: TypedCandidate[]) => Promise<MergeOutcome>;
  fail: (id: string, reason: string) => Promise<void>;
};

export const defaultSteps: HighlightSteps = {
  contextualize: contextualizeHighlight,
  researchers: { event: runEventResearcher, person: runPersonResearcher },
  merge: mergeHighlightInsights,
  fail: failHighlight,
};

/**
 * Durable pipeline for one highlight: Contextualizer, then (unless discarded)
 * the Event and Person Researchers in parallel, then one merge step that turns
 * their candidates into insights. Start with
 * `start(processHighlightWorkflow, [highlightId])` from `workflow/api`.
 * Retries, step caching and replay are the Workflow SDK's defaults.
 */
export async function processHighlightWorkflow(
  highlightId: string,
): Promise<ProcessHighlightResult> {
  "use workflow";

  return orchestrateHighlight(highlightId, defaultSteps);
}

/**
 * The pipeline's branching, with the steps injectable so tests can drive each
 * path. Runs in the Workflow sandbox — keep it pure orchestration; all logic
 * belongs in the `"use step"` functions under `./steps`.
 */
export async function orchestrateHighlight(
  highlightId: string,
  steps: HighlightSteps,
): Promise<ProcessHighlightResult> {
  try {
    const { discarded } = await steps.contextualize(highlightId);
    if (discarded) return { highlightId, discarded, outcome: null };

    const [eventCandidates, personCandidates] = await Promise.all([
      steps.researchers.event(highlightId),
      steps.researchers.person(highlightId),
    ]);
    const outcome = await steps.merge(highlightId, [
      ...eventCandidates,
      ...personCandidates,
    ]);
    return { highlightId, discarded, outcome };
  } catch (error) {
    // Retries are exhausted by the time an error reaches here: leave a
    // terminal status instead of a highlight stuck short of `researched`.
    await steps.fail(
      highlightId,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
