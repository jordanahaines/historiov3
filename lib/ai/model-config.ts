import { resolveModel } from "@/lib/ai/models";

// Cheap model by default for every stage — the Contextualizer and Researchers
// run on every highlight. Escalate per stage with the env var if real output
// shows a stage isn't reliable enough; there is no automatic escalation.
export const DEFAULT_MODEL = "google/gemini-3.8-flash";

export const getContextualizerModel = () =>
  resolveModel("CONTEXTUALIZER_MODEL", DEFAULT_MODEL);
export const getResearcherModel = () =>
  resolveModel("RESEARCHER_MODEL", DEFAULT_MODEL);
export const getInsightMatcherModel = () =>
  resolveModel("INSIGHT_MATCHER_MODEL", DEFAULT_MODEL);
export const getInsightSynthesizerModel = () =>
  resolveModel("INSIGHT_SYNTHESIZER_MODEL", DEFAULT_MODEL);
