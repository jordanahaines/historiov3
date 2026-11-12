/**
 * Insight Matcher agent: decides whether a candidate insight is the same
 * real-world thing as one of the user's shortlisted existing insights.
 * `model` is injected so tests can pass `ai/test`'s mock model.
 */
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

import {
  buildInsightMatcherPrompt,
  INSIGHT_MATCHER_SYSTEM_PROMPT,
  type InsightMatcherPromptInput,
} from "@/lib/ai/prompts/insight-matcher";

/** Bumped by hand when the prompt changes meaningfully. */
export const version = "v1";

export const schema = z.object({
  // 1-based index into the options list, or null for "none".
  matchIndex: z.number().int().nullable(),
  confidence: z.enum(["high", "low"]),
});

export type InsightMatcherResult = z.infer<typeof schema>;
export type InsightMatcherInput = InsightMatcherPromptInput;

export async function run(
  input: InsightMatcherInput,
  { model }: { model: LanguageModel },
): Promise<InsightMatcherResult> {
  const { output } = await generateText({
    model,
    instructions: INSIGHT_MATCHER_SYSTEM_PROMPT,
    prompt: buildInsightMatcherPrompt(input),
    output: Output.object({ schema }),
  });
  return output;
}

/**
 * Turns a matcher answer into the index (0-based) of the option to merge
 * into, or null. A merge needs `high` confidence and an index that actually
 * points at an option — anything else is "no match", because a missed
 * duplicate is cheaper than a wrong merge.
 */
export function resolveMatch(
  result: InsightMatcherResult,
  optionCount: number,
): number | null {
  if (result.confidence !== "high") return null;
  if (result.matchIndex === null) return null;
  const index = result.matchIndex - 1;
  if (index < 0 || index >= optionCount) return null;
  return index;
}
