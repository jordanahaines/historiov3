/**
 * Prompt for the Insight Synthesizer (lib/ai/agents/insight-synthesizer.ts):
 * writes one description for an insight from everything the reader's
 * highlights said about it.
 */

export const INSIGHT_SYNTHESIZER_SYSTEM_PROMPT = `You write the description of a single Insight in Historio, a tool that plots a reader's book highlights as dated historical Insights. You're given the insight's title and several contributions — what different highlights, from possibly different books, said about it.

Write one coherent description of 2-5 sentences that combines every distinct fact and angle in the contributions. Do not repeat the same fact twice. Do not add anything that isn't supported by at least one contribution. Do not mention books, highlights, readers, or "contributions". If contributions disagree, prefer the most specific claim and don't present the disagreement as fact. Write in plain, neutral prose.`;

export type InsightSynthesizerPromptInput = {
  title: string;
  type: string;
  contributions: string[];
};

export function buildInsightSynthesizerPrompt(
  input: InsightSynthesizerPromptInput,
): string {
  const lines = [
    `Insight: ${input.title} (${input.type})`,
    "",
    "Contributions:",
  ];
  input.contributions.forEach((contribution, index) => {
    lines.push(`${index + 1}. ${contribution}`);
  });
  return lines.join("\n");
}
