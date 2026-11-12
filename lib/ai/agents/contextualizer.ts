/**
 * Contextualizer agent: judges whether a highlight is groundable in real
 * history and, if so, hands the Researchers a head start. See
 * `lib/ai/prompts/contextualizer.ts` for the prompt this calls with.
 *
 * `run`'s `model` is injected so tests can pass `ai/test`'s mock model
 * instead of hitting a real provider (per CLAUDE.md's AI conventions).
 */
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";

import {
  buildContextualizerPrompt,
  CONTEXTUALIZER_SYSTEM_PROMPT,
  type ContextualizerPromptInput,
} from "@/lib/ai/prompts/contextualizer";

/** Bumped by hand when the prompt changes meaningfully. Not persisted yet. */
export const version = "v1";

export const schema = z
  .object({
    discard: z.boolean(),
    discardReason: z.string().nullable(),
    context: z.string().nullable(),
  })
  .superRefine((value, ctx) => {
    if (value.discard && !value.discardReason) {
      ctx.addIssue({
        code: "custom",
        message: "discardReason is required when discard is true",
        path: ["discardReason"],
      });
    }
    if (!value.discard && !value.context) {
      ctx.addIssue({
        code: "custom",
        message: "context is required when discard is false",
        path: ["context"],
      });
    }
  });

export type ContextualizerResult = z.infer<typeof schema>;

export type ContextualizerInput = ContextualizerPromptInput;

export type RunContextualizerOptions = {
  model: LanguageModel;
};

/**
 * Calls the model with structured output and returns the schema-validated
 * result. Throws (rather than returning a partial/invalid result) on a
 * malformed or off-schema response — callers should leave any "already
 * processed" marker unset so the highlight is retried later.
 */
export async function run(
  input: ContextualizerInput,
  { model }: RunContextualizerOptions,
): Promise<ContextualizerResult> {
  const { output } = await generateText({
    model,
    instructions: CONTEXTUALIZER_SYSTEM_PROMPT,
    prompt: buildContextualizerPrompt(input),
    output: Output.object({ schema }),
  });
  return output;
}
