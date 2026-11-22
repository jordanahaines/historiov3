import type { HighlightStatus } from "@/lib/library/types";

export type StatusLabel = { label: string; muted: boolean };

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
