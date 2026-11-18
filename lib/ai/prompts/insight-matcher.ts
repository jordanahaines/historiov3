/**
 * Prompt for the Insight Matcher (lib/ai/agents/insight-matcher.ts): decides
 * whether a newly researched candidate is the same real-world thing as one of
 * a user's existing insights.
 */

export const INSIGHT_MATCHER_SYSTEM_PROMPT = `You are the duplicate detector for Historio, a tool that plots a reader's book highlights as dated historical Insights (events, people, places, concepts). You're given a NEW candidate insight and a numbered list of EXISTING insights from the same reader that might be the same thing.

Decide whether the new candidate and exactly one existing insight refer to the same real-world person, event, place, or concept. Titles often differ ("Titanic sinking" vs "Sinking of the Titanic", "Julius Caesar" vs "Gaius Julius Caesar") — judge by what they are, not by wording. Dates and places should be compatible; small differences in precision are normal.

Do NOT match when they are merely related: a cause and its effect, a person and an event they took part in, a war and one of its battles, a city and an event in it, an earlier and a later event in a series. Those are distinct insights.

Answer with matchIndex = the number of the matching existing insight, or null if none is the same thing. Set confidence to "high" only when you are sure; if you are guessing or the match is plausible but uncertain, set "low". A wrong merge is much worse than a missed duplicate, so when in doubt answer null.`;

export type MatcherCandidateInput = {
  type: string;
  title: string;
  description: string | null;
  period: string;
  locationHint: string | null;
};

export type MatcherOptionInput = {
  title: string;
  aliases: string[];
  description: string | null;
  period: string;
  locationName: string | null;
};

export type InsightMatcherPromptInput = {
  candidate: MatcherCandidateInput;
  options: MatcherOptionInput[];
};

export function buildInsightMatcherPrompt(
  input: InsightMatcherPromptInput,
): string {
  const { candidate, options } = input;
  const lines = [
    "NEW candidate:",
    `- Type: ${candidate.type}`,
    `- Title: ${candidate.title}`,
    `- When: ${candidate.period}`,
  ];
  if (candidate.locationHint) lines.push(`- Where: ${candidate.locationHint}`);
  if (candidate.description) {
    lines.push(`- Description: ${candidate.description}`);
  }
  lines.push("", "EXISTING insights:");
  options.forEach((option, index) => {
    lines.push(`${index + 1}. ${option.title}`);
    if (option.aliases.length > 0) {
      lines.push(`   Also known as: ${option.aliases.join("; ")}`);
    }
    lines.push(`   When: ${option.period}`);
    if (option.locationName) lines.push(`   Where: ${option.locationName}`);
    if (option.description) {
      lines.push(`   Description: ${option.description}`);
    }
  });
  return lines.join("\n");
}
