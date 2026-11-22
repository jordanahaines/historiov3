/**
 * Insight Synthesizer agent: regenerates an insight's description from all
 * contributions. `model` is injected so tests can pass `ai/test`'s mock model.
 */
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

import {
  buildInsightSynthesizerPrompt,
  INSIGHT_SYNTHESIZER_SYSTEM_PROMPT,
  type InsightSynthesizerPromptInput,
} from "@/lib/ai/prompts/insight-synthesizer";

/** Bumped by hand when the prompt changes meaningfully. */
export const version = "v1";

export const schema = z.object({
  description: z.string().trim().min(1),
});

export type InsightSynthesizerResult = z.infer<typeof schema>;
export type InsightSynthesizerInput = InsightSynthesizerPromptInput;

export async function run(
  input: InsightSynthesizerInput,
  { model }: { model: LanguageModel },
): Promise<InsightSynthesizerResult> {
  const { output } = await generateText({
    model,
    instructions: INSIGHT_SYNTHESIZER_SYSTEM_PROMPT,
    prompt: buildInsightSynthesizerPrompt(input),
    output: Output.object({ schema }),
  });
  return output;
}
