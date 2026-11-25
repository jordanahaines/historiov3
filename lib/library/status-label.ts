import type { HighlightStatus } from "@/lib/library/types";

export type StatusLabel = { label: string; muted: boolean };

/** How one of the three step dots is drawn. */
export type StepState = "active" | "passed" | "upcoming";

export type StatusSteps = {
  /** Pending, Contextualized, then the outcome dot. */
  steps: [StepState, StepState, StepState];
  /** How the last dot looks once it is active: bold, a green check or red. */
  outcome: "discarded" | "researched" | "failed" | null;
  name: string;
  explanation: string;
};

/**
 * The status as three connected dots: Pending → Contextualized → the outcome.
 * The active dot is bold (or green check / red for the outcomes), earlier
 * steps are lightly filled as passed, later ones are hollow.
 */
export function highlightStatusSteps(status: HighlightStatus): StatusSteps {
  switch (status) {
    case "pending":
      return {
        steps: ["active", "upcoming", "upcoming"],
        outcome: null,
        name: "Pending",
        explanation:
          "Captured, waiting to be placed in the context of its book.",
      };
    case "contextualized":
      return {
        steps: ["passed", "active", "upcoming"],
        outcome: null,
        name: "Contextualized",
        explanation: "Placed in context; research into insights is next.",
      };
    case "researched":
      return {
        steps: ["passed", "passed", "active"],
        outcome: "researched",
        name: "Researched",
        explanation: "Done: turned into insights, or matched to existing ones.",
      };
    case "failed":
      return {
        steps: ["passed", "passed", "active"],
        outcome: "failed",
        name: "Failed",
        explanation: "Processing hit an error after retries; it can be re-run.",
      };
    case "discarded":
      return {
        steps: ["passed", "passed", "active"],
        outcome: "discarded",
        name: "Discarded",
        explanation: "Skipped: not worth turning into an insight.",
      };
  }
}

/** Pipeline status as the Library shows it; only Researched isn't muted. */
export function highlightStatusLabel(status: HighlightStatus): StatusLabel {
  switch (status) {
    case "researched":
      return { label: "Researched", muted: false };
    case "pending":
    case "contextualized":
      return { label: "Pending", muted: true };
    case "discarded":
      return { label: "Discarded", muted: true };
    case "failed":
      return { label: "Failed", muted: true };
  }
}
