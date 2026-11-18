import { FatalError } from "workflow";

import * as contextualizer from "@/lib/ai/agents/contextualizer";
import { getContextualizerModel } from "@/lib/ai/model-config";
import { getBookById } from "@/lib/authz/books";
import {
  getHighlightById,
  recordContextualizerAnalysis,
} from "@/lib/authz/highlights";

export type ContextualizeHighlightResult = { discarded: boolean };

export async function contextualizeHighlight(
  highlightId: string,
): Promise<ContextualizeHighlightResult> {
  "use step";

  const highlight = await getHighlightById(highlightId);
  if (!highlight) {
    // Retrying won't make a missing row appear.
    throw new FatalError(`Highlight ${highlightId} not found`);
  }

  // Already contextualized — a replayed step or a resume. Never call the model
  // twice for one highlight.
  if (highlight.status === "discarded") return { discarded: true };
  if (highlight.context) return { discarded: false };

  const book = await getBookById(highlight.bookId);
  if (!book) {
    throw new FatalError(
      `Book ${highlight.bookId} not found for highlight ${highlightId}`,
    );
  }

  // A schema-invalid model response throws here (retried by the runtime);
  // nothing is written until the result validates.
  const result = await contextualizer.run(
    {
      bookTitle: book.title,
      bookAuthor: book.author,
      highlightedText: highlight.highlightedText,
      noteText: highlight.noteText,
    },
    { model: getContextualizerModel() },
  );

  const recorded = await recordContextualizerAnalysis(
    highlightId,
    result.discard
      ? { discard: true, discardReason: result.discardReason as string }
      : { discard: false, context: result.context as string },
  );

  return { discarded: recorded.status === "discarded" };
}
