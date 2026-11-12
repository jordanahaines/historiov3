export type ResearcherPromptInput = {
  bookTitle: string;
  /** Null when the Book's author isn't known. */
  bookAuthor: string | null;
  highlightedText: string;
  /** Null when the highlight has no reader's note. */
  noteText: string | null;
  /** The Contextualizer's output for this highlight. */
  context: string;
};

/**
 * Builds the per-call input shared by every Researcher:
 *
 * ```
 * Book: {title}{ by {author}, if known}
 * Highlighted passage: "{highlighted_text}"
 * {Reader's note: "{note_text}" — only included when present}
 * Context (from an earlier pass): {context}
 * ```
 */
export function buildResearcherPrompt(input: ResearcherPromptInput): string {
  const lines = [
    `Book: ${input.bookTitle}${input.bookAuthor ? ` by ${input.bookAuthor}` : ""}`,
    `Highlighted passage: "${input.highlightedText}"`,
  ];
  if (input.noteText) {
    lines.push(`Reader's note: "${input.noteText}"`);
  }
  lines.push(`Context (from an earlier pass): ${input.context}`);
  return lines.join("\n");
}
