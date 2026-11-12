import * as eventResearcher from "@/lib/ai/agents/event-researcher";
import type { TypedCandidate } from "@/lib/insights/candidate";

import { researchHighlight } from "./research-highlight";

export async function runEventResearcher(
  highlightId: string,
): Promise<TypedCandidate[]> {
  "use step";

  return researchHighlight({
    highlightId,
    type: "event",
    agent: eventResearcher,
  });
}
