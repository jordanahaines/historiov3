import { FatalError } from "workflow";

import type { LanguageModel } from "ai";

import type { ResearcherResult } from "@/lib/ai/agents/researcher-schema";
import { getResearcherModel } from "@/lib/ai/model-config";
import type { ResearcherPromptInput } from "@/lib/ai/prompts/researchers/researcher-input";
import { getBookById } from "@/lib/authz/books";
import { getHighlightById } from "@/lib/authz/highlights";
import type { InsightType, TypedCandidate } from "@/lib/insights/candidate";

export type ResearcherAgent = {
  run: (
    input: ResearcherPromptInput,
    options: { model: LanguageModel },
  ) => Promise<ResearcherResult>;
};

/**
 * The body shared by the Event and Person Researcher steps: runs the agent and
 * returns tagged candidates. Writes nothing — candidates are persisted by the
 * merge step, together with the highlight's status, in one transaction.
 * Plain (not "use step") so the steps stay thin and tests can inject a fake
 * agent.
 */
export async function researchHighlight(options: {
  highlightId: string;
  type: InsightType;
  agent: ResearcherAgent;
  model?: LanguageModel | string;
}): Promise<TypedCandidate[]> {
  const highlight = await getHighlightById(options.highlightId);
  if (!highlight) {
    throw new FatalError(`Highlight ${options.highlightId} not found`);
  }
  // Already finished (replay/resume) or never groundable: nothing to research.
  if (highlight.status === "researched" || highlight.status === "discarded") {
    return [];
  }
  if (!highlight.context) {
    throw new FatalError(
      `Highlight ${options.highlightId} has no context — run the Contextualizer first`,
    );
  }

  const book = await getBookById(highlight.bookId);
  if (!book) {
    throw new FatalError(
      `Book ${highlight.bookId} not found for highlight ${options.highlightId}`,
    );
  }

  const { candidates } = await options.agent.run(
    {
      bookTitle: book.title,
      bookAuthor: book.author,
      highlightedText: highlight.highlightedText,
      noteText: highlight.noteText,
      context: highlight.context,
    },
    { model: (options.model ?? getResearcherModel()) as LanguageModel },
  );

  return candidates.map((candidate) => ({ ...candidate, type: options.type }));
}
