/**
 * Event Researcher agent: proposes zero or more datable candidate Insights
 * from a contextualized highlight. See
 * `lib/ai/prompts/researchers/event-researcher.ts` for the prompt.
 *
 * `run`'s `model` is injected so tests can pass `ai/test`'s mock model
 * instead of hitting a real provider (per CLAUDE.md's AI conventions).
 */
import { generateText, Output, type LanguageModel } from "ai";

import {
  buildEventResearcherPrompt,
  EVENT_RESEARCHER_SYSTEM_PROMPT,
  type EventResearcherPromptInput,
} from "@/lib/ai/prompts/researchers/event-researcher";
import {
  researcherSchema,
  type ResearcherResult,
} from "@/lib/ai/agents/researcher-schema";

/** Bumped by hand when the prompt changes meaningfully. Not persisted yet. */
export const version = "v1";

export const schema = researcherSchema;

export type EventResearcherResult = ResearcherResult;

export type EventResearcherInput = EventResearcherPromptInput;

export type RunEventResearcherOptions = {
  model: LanguageModel;
};

/**
 * Calls the model with structured output and returns the schema-validated
 * result. An empty `candidates` array is a valid result. Throws (rather than
 * returning a partial/invalid result) on a malformed or off-schema response.
 */
export async function run(
  input: EventResearcherInput,
  { model }: RunEventResearcherOptions,
): Promise<EventResearcherResult> {
  const { output } = await generateText({
    model,
    instructions: EVENT_RESEARCHER_SYSTEM_PROMPT,
    prompt: buildEventResearcherPrompt(input),
    output: Output.object({ schema }),
  });
  return output;
}
